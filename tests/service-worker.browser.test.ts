import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
import test from "node:test";

const CHROME = process.env.CHROME_BIN || "/usr/bin/google-chrome";
const workerSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

async function unusedPort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function createFixtureServer() {
  const requests = [];
  const state = { online: true };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Diarium browser fixture</title></head>
<body><main id="app-shell">Diarium public shell fixture</main><script>
window.__fixtureLoadId = Number(sessionStorage.getItem("fixture-load-count") || "0") + 1;
sessionStorage.setItem("fixture-load-count", String(window.__fixtureLoadId));
(async function () {
  if (!sessionStorage.getItem("fixture-seeded")) {
    sessionStorage.setItem("fixture-seeded", "yes");
    const prior = await caches.open("diarium-v7");
    await prior.put(new Request(location.origin + "/api/export/csv?synthetic=1"), new Response("old cache synthetic account A export"));
    const unrelated = await caches.open("other-app-cache");
    await unrelated.put(new Request(location.origin + "/unrelated"), new Response("other app data"));
  }
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  document.documentElement.dataset.workerReady = "yes";
})();
</script></body></html>`;

  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    requests.push({ path: `${url.pathname}${url.search}`, cookie: request.headers.cookie || "" });
    if (!state.online) {
      request.socket.destroy();
      return;
    }
    if (url.pathname === "/sw.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(workerSource);
      return;
    }
    if (url.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "s-maxage=31536000",
        Vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding",
      });
      response.end(html);
      return;
    }
    if (url.pathname === "/icon-192.png") {
      response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", Vary: "Cookie" });
      response.end("synthetic-icon");
      return;
    }
    if (url.pathname === "/manifest.json") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Authorization" });
      response.end(JSON.stringify({ name: "synthetic manifest" }));
      return;
    }
    if (url.pathname === "/account/export.csv" || url.pathname === "/api/export/csv") {
      const account = request.headers.cookie.includes("account=B") ? "B" : "A";
      response.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      response.end(`synthetic account ${account} export`);
      return;
    }
    if (url.pathname === "/auth/callback") {
      response.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      response.end("fresh synthetic callback response");
      return;
    }
    response.writeHead(404, { "Cache-Control": "no-store" });
    response.end("not found");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return { server, requests, state, origin: `http://127.0.0.1:${port}` };
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });
  return {
    onMessage(listener) { listeners.add(listener); },
    call(method, params = {}, sessionId) {
      const id = ++sequence;
      const message = { id, method, params };
      if (sessionId) message.sessionId = sessionId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify(message));
      });
    },
    close() { socket.close(); },
  };
}

async function waitForPage(cdp, sessionId, expression, timeoutMs = 15000) {
  const expires = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < expires) {
    try {
      const response = await cdp.call("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId);
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
      if (response.result.value) return response.result.value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}${lastError ? ` (${lastError})` : ""}`);
}

async function evaluate(cdp, sessionId, expression) {
  const response = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }, sessionId);
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function navigate(cdp, sessionId, url) {
  let previousLoad = 0;
  try {
    previousLoad = await evaluate(cdp, sessionId, "window.__fixtureLoadId || 0");
  } catch {}
  await cdp.call("Page.navigate", { url }, sessionId);
  return waitForPage(cdp, sessionId,
    `document.readyState === "complete" && document.documentElement.dataset.workerReady === "yes" && Number(window.__fixtureLoadId) > ${previousLoad}`);
}

async function startChrome(profileDir) {
  const port = await unusedPort();
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--disable-background-networking", "--disable-extensions", "--no-first-run",
    "--disable-default-apps", "--remote-allow-origins=*", `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const expires = Date.now() + 15000;
  let version;
  while (Date.now() < expires) {
    if (chrome.exitCode !== null) throw new Error(`Chrome exited early: ${stderr}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        version = await response.json();
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!version) throw new Error(`Chrome DevTools did not start: ${stderr}`);
  return { chrome, version, stderr: () => stderr };
}

test("real Chromium preserves the public shell and blocks cross-account cache disclosure", {
  skip: !existsSync(CHROME),
  timeout: 120000,
}, async () => {
  const scratch = process.env.TMPDIR;
  assert.ok(scratch, "TMPDIR must point at the profile scratch directory");
  const profileDir = mkdtempSync(join(scratch, "diarium-sw-chrome-"));
  const fixture = await createFixtureServer();
  let browser;
  let cdp;
  const consoleErrors = [];
  try {
    browser = await startChrome(profileDir);
    cdp = await connectCdp(browser.version.webSocketDebuggerUrl);
    const { targetId } = await cdp.call("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.call("Target.attachToTarget", { targetId, flatten: true });
    cdp.onMessage((message) => {
      if (message.sessionId === sessionId && message.method === "Runtime.exceptionThrown") {
        consoleErrors.push(message.params.exceptionDetails.text);
      }
      if (message.method === "Target.attachedToTarget" && message.params.targetInfo.type === "service_worker") {
        cdp.call("Runtime.enable", {}, message.params.sessionId).catch(() => {});
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        const text = message.params.args.map((arg) => arg.value || arg.description || "").join(" ");
        if (text) consoleErrors.push(text);
      }
    });
    await cdp.call("Page.enable", {}, sessionId);
    await cdp.call("Runtime.enable", {}, sessionId);
    await cdp.call("Network.enable", {}, sessionId);
    await cdp.call("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    }, sessionId);

    await navigate(cdp, sessionId, fixture.origin);
    await waitForPage(cdp, sessionId,
      `navigator.serviceWorker.controller !== null && document.documentElement.dataset.workerReady === "yes"`);

    const activationState = await evaluate(cdp, sessionId, `(async () => ({
      cacheNames: await caches.keys(),
      oldDiariumCacheExists: (await caches.keys()).includes("diarium-v7"),
      unrelatedCacheExists: (await caches.keys()).includes("other-app-cache")
    }))()`);
    assert.equal(activationState.oldDiariumCacheExists, false, "activation must delete old Diarium cache");
    assert.equal(activationState.unrelatedCacheExists, true, "activation must preserve unrelated caches");

    await evaluate(cdp, sessionId, `document.cookie = "account=A; path=/; SameSite=Lax"`);
    await navigate(cdp, sessionId, fixture.origin);
    const shellState = await waitForPage(cdp, sessionId, `(async () => {
      const cache = await caches.open("diarium-v8");
      const shell = await cache.match(new Request(location.origin + "/"));
      return shell ? await shell.text() : "";
    })()`);
    assert.match(shellState, /Diarium public shell fixture/, "the shell navigation response must be cached before body consumption");

    const assetResult = await evaluate(cdp, sessionId, `(async () => {
      const response = await fetch("/icon-192.png");
      const text = await response.text();
      const cache = await caches.open("diarium-v8");
      return { text, cached: !!(await cache.match(new Request(location.origin + "/icon-192.png"))) };
    })()`);
    assert.equal(assetResult.text, "synthetic-icon");
    assert.equal(assetResult.cached, false, "Vary: Cookie assets must not be cached");

    const privateAssetResult = await evaluate(cdp, sessionId, `(async () => {
      const response = await fetch("/manifest.json");
      const text = await response.text();
      const cache = await caches.open("diarium-v8");
      return { text, cached: !!(await cache.match(new Request(location.origin + "/manifest.json"))) };
    })()`);
    assert.match(privateAssetResult.text, /synthetic manifest/);
    assert.equal(privateAssetResult.cached, false, "private/no-store assets must not be cached");

    const accountAResult = await evaluate(cdp, sessionId, `(async () => {
      const response = await fetch("/account/export.csv?synthetic=1");
      const text = await response.text();
      const cache = await caches.open("diarium-v8");
      const cached = await cache.match(new Request(location.origin + "/account/export.csv?synthetic=1"));
      return { text, cached: !!cached };
    })()`);
    assert.equal(accountAResult.text, "synthetic account A export");
    assert.equal(accountAResult.cached, false, "default same-origin credentials do not permit arbitrary caching");

    await evaluate(cdp, sessionId, `(async () => {
      const cache = await caches.open("diarium-v8");
      for (const path of ["/account/export.csv?synthetic=1", "/api/export/csv?synthetic=1", "/auth/callback?code=synthetic"]) {
        await cache.put(new Request(location.origin + path), new Response("synthetic account A export"));
      }
      document.cookie = "account=B; path=/; SameSite=Lax";
      return true;
    })()`);
    fixture.state.online = false;
    const isolationResults = await evaluate(cdp, sessionId, `(async () => {
      const paths = ["/account/export.csv?synthetic=1", "/api/export/csv?synthetic=1", "/auth/callback?code=synthetic"];
      const results = {};
      for (const path of paths) {
        try {
          const response = await fetch(path);
          results[path] = { status: response.status, body: await response.text() };
        } catch (error) {
          results[path] = { error: error.name };
        }
      }
      return results;
    })()`);
    for (const result of Object.values(isolationResults)) {
      assert.doesNotMatch(result.body || "", /synthetic account A export|old cache/, "account A data must not be disclosed offline");
      assert.ok(result.error || result.status >= 500, `sensitive routes must fail closed while offline: ${JSON.stringify(isolationResults)}`);
    }

    await navigate(cdp, sessionId, fixture.origin);
    const offlineShell = await evaluate(cdp, sessionId,
      `document.querySelector("#app-shell")?.textContent || "missing shell"`);
    assert.equal(offlineShell, "Diarium public shell fixture", "the public app shell must still render offline");

    const finalCacheNames = await evaluate(cdp, sessionId, `caches.keys()`);
    assert.ok(finalCacheNames.includes("diarium-v8"));
    assert.ok(finalCacheNames.includes("other-app-cache"));
    const rootRequests = fixture.requests.filter((request) => request.path === "/");
    assert.ok(rootRequests.length >= 2, "the controlled browser must perform a second shell fetch");
    assert.ok(rootRequests.every((request) => !request.cookie.includes("account=")), "the cacheable shell fetch must omit account cookies");
    assert.ok(!consoleErrors.length, `browser/service-worker console errors: ${consoleErrors.join(" | ")}`);
    assert.ok(fixture.requests.some((request) => request.path === "/account/export.csv?synthetic=1" && request.cookie.includes("account=A")));
  } catch (error) {
    error.message += `\nBrowser console errors: ${consoleErrors.join(" | ")}`;
    if (browser) error.message += `\nChrome stderr: ${browser.stderr()}`;
    throw error;
  } finally {
    if (cdp) cdp.close();
    if (browser?.chrome && browser.chrome.exitCode === null) {
      browser.chrome.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => browser.chrome.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      if (browser.chrome.exitCode === null) browser.chrome.kill("SIGKILL");
    }
    await new Promise((resolve) => fixture.server.close(resolve));
    rmSync(profileDir, { recursive: true, force: true });
  }
});
