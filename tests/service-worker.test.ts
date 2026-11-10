import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://diarium.digitalni-vedomi.cz";

function createWorker({ fetchImpl, cacheEntries = {} } = {}) {
  const listeners = new Map();
  const cacheStore = new Map();
  const cacheWrites = [];
  const cacheMatches = [];
  const deletedCaches = [];
  const fetchCalls = [];
  const lifecycleCalls = [];

  for (const [name, entries] of Object.entries(cacheEntries)) {
    cacheStore.set(name, new Map(entries.map(([url, response]) => [url, response])));
  }

  const cacheStorage = {
    async keys() {
      return [...cacheStore.keys()];
    },
    async delete(name) {
      deletedCaches.push(name);
      return cacheStore.delete(name);
    },
    async open(name) {
      if (!cacheStore.has(name)) cacheStore.set(name, new Map());
      const entries = cacheStore.get(name);
      return {
        async put(request, response) {
          cacheWrites.push({ name, url: request.url });
          entries.set(request.url, response);
        },
        async match(request) {
          cacheMatches.push({ name, url: request.url });
          return entries.get(request.url)?.clone();
        },
      };
    },
    async match(request) {
      cacheMatches.push({ name: "*", url: request.url });
      for (const entries of cacheStore.values()) {
        const response = entries.get(request.url);
        if (response) return response.clone();
      }
      return undefined;
    },
  };

  const clients = {
    async claim() {
      lifecycleCalls.push("clients.claim");
    },
  };
  const self = {
    location: { origin: ORIGIN },
    clients,
    registration: {
      async unregister() {
        lifecycleCalls.push("registration.unregister");
      },
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    skipWaiting() {
      lifecycleCalls.push("skipWaiting");
    },
  };

  runInNewContext(source, {
    self,
    clients,
    caches: cacheStorage,
    URL,
    Request,
    Response,
    Headers,
    AbortController,
    Promise,
    setTimeout,
    clearTimeout,
    fetch: (...args) => {
      fetchCalls.push(args);
      return fetchImpl(...args);
    },
  });

  return {
    listeners,
    cacheStore,
    cacheWrites,
    cacheMatches,
    deletedCaches,
    fetchCalls,
    lifecycleCalls,
  };
}

function dispatchFetch(worker, request) {
  let responsePromise;
  const lifetimePromises = [];
  worker.listeners.get("fetch")({
    request,
    respondWith(value) {
      responsePromise = Promise.resolve(value);
    },
    waitUntil(value) {
      lifetimePromises.push(Promise.resolve(value));
    },
  });
  return {
    responsePromise,
    lifetimePromise: Promise.all(lifetimePromises),
  };
}

test("API export never serves stale v6 data when the network fails", async () => {
  const exportUrl = `${ORIGIN}/api/export/csv?mode=spreadsheet-safe`;
  const worker = createWorker({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    cacheEntries: {
      // v6 stored the response without Vary: Authorization or Cache-Control.
      "diarium-v6": [[exportUrl, new Response("user A export")]],
    },
  });
  const request = new Request(exportUrl, {
    headers: { Authorization: "Bearer user-B" },
  });

  const { responsePromise } = dispatchFetch(worker, request);
  await assert.rejects(responsePromise, /network unavailable/);
  assert.equal(worker.fetchCalls.length, 1);
  assert.equal(worker.cacheMatches.length, 0, "API must never read CacheStorage");
  assert.equal(worker.cacheWrites.length, 0, "API must never write CacheStorage");
});

test("every API method goes to the network without consulting or updating any cache", async () => {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  const urls = methods.map((method) => `${ORIGIN}/api/export/csv?method=${method}`);
  const worker = createWorker({
    fetchImpl: async (request) => new Response(`network:${new URL(request.url).searchParams.get("method")}`),
    cacheEntries: {
      "diarium-v6": urls.map((url) => [url, new Response("stale user A data")]),
    },
  });

  for (const method of methods) {
    const request = new Request(`${ORIGIN}/api/export/csv?method=${method}`, {
      method,
      headers: method === "GET" ? { Authorization: "Bearer user-B" } : {},
    });
    const dispatched = dispatchFetch(worker, request);
    assert.ok(dispatched.responsePromise, `${method} API request should use the network`);
    const response = await dispatched.responsePromise;
    await dispatched.lifetimePromise;
    assert.equal(await response.text(), `network:${method}`);
  }

  assert.equal(worker.fetchCalls.length, methods.length);
  assert.equal(worker.cacheMatches.length, 0);
  assert.equal(worker.cacheWrites.length, 0);
});

test("authenticated non-API requests never use stale cache on success or failure", async () => {
  const url = `${ORIGIN}/account/export.csv`;
  let online = true;
  const worker = createWorker({
    fetchImpl: async () => {
      if (!online) throw new Error("network unavailable");
      return new Response("current account export");
    },
    cacheEntries: {
      // This v6 entry has no Cache-Control marker; Authorization must suffice.
      "diarium-v6": [[url, new Response("stale account A export")]],
    },
  });
  const request = new Request(url, { headers: { Authorization: "Bearer user-B" } });

  let dispatched = dispatchFetch(worker, request);
  const response = await dispatched.responsePromise;
  await dispatched.lifetimePromise;
  assert.equal(await response.text(), "current account export");

  online = false;
  dispatched = dispatchFetch(worker, request);
  await assert.rejects(dispatched.responsePromise, /network unavailable/);
  await dispatched.lifetimePromise;
  assert.equal(worker.cacheMatches.length, 0);
  assert.equal(worker.cacheWrites.length, 0);
});

test("credentialed same-origin requests never use stale cache on failure", async () => {
  const url = `${ORIGIN}/account/export.csv`;
  const worker = createWorker({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    cacheEntries: {
      "diarium-v6": [[url, new Response("stale account A export")]],
    },
  });
  const request = new Request(url, { credentials: "include" });

  const dispatched = dispatchFetch(worker, request);
  await assert.rejects(dispatched.responsePromise, /network unavailable/);
  await dispatched.lifetimePromise;
  assert.equal(worker.cacheMatches.length, 0);
  assert.equal(worker.cacheWrites.length, 0);
});

test("default same-origin credentials do not make an arbitrary GET cacheable", async () => {
  const url = `${ORIGIN}/account/export.csv`;
  const worker = createWorker({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    cacheEntries: {
      "diarium-v7": [[url, new Response("stale account A export")]],
      "diarium-v8": [[url, new Response("stale account A export")]],
    },
  });
  const request = new Request(url);

  assert.equal(request.credentials, "same-origin");
  const dispatched = dispatchFetch(worker, request);
  await assert.rejects(dispatched.responsePromise, /network unavailable/);
  await dispatched.lifetimePromise;
  assert.equal(worker.cacheMatches.length, 0, "non-whitelisted paths must not read CacheStorage");
  assert.equal(worker.cacheWrites.length, 0, "non-whitelisted paths must not write CacheStorage");
});

test("public whitelist responses with private or sensitive Vary headers are not cached", async () => {
  const unsafeHeaders = [
    { "Cache-Control": "private" },
    { "Cache-Control": "no-store" },
    { "Cache-Control": "no-cache" },
    { Vary: "Cookie" },
    { Vary: "Authorization" },
    { Vary: "Accept-Encoding, cOoKiE" },
    { Vary: "*" },
    { "Set-Cookie": "synthetic=1; Path=/" },
  ];

  for (const headers of unsafeHeaders) {
    const url = `${ORIGIN}/icon-192.png`;
    const worker = createWorker({
      fetchImpl: async () => new Response("public-looking but unsafe", { headers }),
    });
    const dispatched = dispatchFetch(worker, new Request(url));
    const response = await dispatched.responsePromise;
    await dispatched.lifetimePromise;
    assert.equal(await response.text(), "public-looking but unsafe");
    assert.equal(worker.cacheWrites.length, 0, JSON.stringify(headers));
  }
});

test("Authorization and include-credentialed allowlisted assets bypass CacheStorage", async () => {
  const url = `${ORIGIN}/icon-192.png`;
  const cases = [
    new Request(url, { credentials: "include" }),
    new Request(url, { headers: { Authorization: "Bearer synthetic-user-B" } }),
  ];

  for (const request of cases) {
    const worker = createWorker({
      fetchImpl: async () => new Response("network public asset"),
      cacheEntries: {
        "diarium-v8": [[url, new Response("stale synthetic user-A asset")]],
      },
    });
    const dispatched = dispatchFetch(worker, request);
    const response = await dispatched.responsePromise;
    await dispatched.lifetimePromise;
    assert.equal(await response.text(), "network public asset");
    assert.equal(worker.cacheMatches.length, 0);
    assert.equal(worker.cacheWrites.length, 0);
  }
});

test("private and no-store whitelisted responses are not served from cache offline", async () => {
  for (const directive of ["private", "no-store", "no-cache", "private, no-store"]) {
    const url = `${ORIGIN}/icon-192.png`;
    let online = true;
    const worker = createWorker({
      fetchImpl: async () => {
        if (!online) throw new Error("network unavailable");
        return new Response("current private response", {
          headers: { "Cache-Control": directive },
        });
      },
      cacheEntries: {
        "diarium-v8": [[
          url,
          new Response("stale private response", { headers: { "Cache-Control": directive } }),
        ]],
      },
    });
    const request = new Request(url);

    let dispatched = dispatchFetch(worker, request);
    let response = await dispatched.responsePromise;
    await dispatched.lifetimePromise;
    assert.equal(await response.text(), "current private response");
    assert.equal(worker.cacheWrites.length, 0, `${directive} response must not be cached`);

    online = false;
    dispatched = dispatchFetch(worker, request);
    response = await dispatched.responsePromise;
    await dispatched.lifetimePromise;
    assert.equal(response.status, 503, `${directive} stale response must not be served`);
    assert.equal(await response.text(), "Offline");
    assert.equal(worker.cacheMatches.length, 1);
  }
});

test("OAuth callback URLs are network-only on success and failure", async () => {
  const successUrl = `${ORIGIN}/auth-callback.html?code=synthetic-code`;
  const failureUrl = `${ORIGIN}/auth/callback?code=synthetic-code`;
  let online = true;
  const worker = createWorker({
    fetchImpl: async (request) => {
      if (!online) throw new Error("network unavailable");
      return new Response(`network:${new URL(request.url).pathname}`);
    },
    cacheEntries: {
      "diarium-v8": [
        [successUrl, new Response("stale callback response")],
        [failureUrl, new Response("stale callback response")],
      ],
    },
  });

  let dispatched = dispatchFetch(worker, new Request(successUrl));
  const response = await dispatched.responsePromise;
  await dispatched.lifetimePromise;
  assert.equal(await response.text(), "network:/auth-callback.html");

  online = false;
  dispatched = dispatchFetch(worker, new Request(failureUrl));
  await assert.rejects(dispatched.responsePromise, /network unavailable/);
  await dispatched.lifetimePromise;
  assert.equal(worker.cacheMatches.length, 0);
  assert.equal(worker.cacheWrites.length, 0);
});

test("cross-origin GET requests are network-only", async () => {
  const worker = createWorker({
    fetchImpl: async () => new Response("cross-origin network response"),
  });
  const request = new Request("https://cdn.example.test/app.js");

  const dispatched = dispatchFetch(worker, request);
  const response = await dispatched.responsePromise;
  await dispatched.lifetimePromise;
  assert.equal(await response.text(), "cross-origin network response");
  assert.equal(worker.cacheMatches.length, 0);
  assert.equal(worker.cacheWrites.length, 0);
});

test("public same-origin static assets retain cache and offline fallback behavior", async () => {
  const assetUrl = `${ORIGIN}/icon-192.png`;
  const worker = createWorker({
    fetchImpl: async () => new Response("public asset"),
  });

  let dispatched = dispatchFetch(worker, new Request(assetUrl));
  let response = await dispatched.responsePromise;
  await dispatched.lifetimePromise;
  assert.equal(await response.text(), "public asset");
  assert.deepEqual(worker.cacheWrites, [{ name: "diarium-v8", url: assetUrl }]);

  const offlineWorker = createWorker({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    cacheEntries: {
      "diarium-v8": [[assetUrl, new Response("cached public asset")]],
    },
  });
  dispatched = dispatchFetch(offlineWorker, new Request(assetUrl));
  response = await dispatched.responsePromise;
  await dispatched.lifetimePromise;
  assert.equal(await response.text(), "cached public asset");
  assert.equal(offlineWorker.cacheMatches.length, 1);

  const offlineNavigationWorker = createWorker({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
  });
  const navigationRequest = {
    url: `${ORIGIN}/`,
    method: "GET",
    headers: new Headers(),
    credentials: "same-origin",
    mode: "navigate",
  };
  dispatched = dispatchFetch(offlineNavigationWorker, navigationRequest);
  response = await dispatched.responsePromise;
  await dispatched.lifetimePromise;
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Aplikace je momentálně offline/);
});

test("public shell is cached and served offline while an unlisted URL is not", async () => {
  const rootUrl = `${ORIGIN}/`;
  const navigationRequest = {
    url: rootUrl,
    method: "GET",
    headers: new Headers(),
    credentials: "same-origin",
    mode: "navigate",
  };
  const worker = createWorker({
    fetchImpl: async () => new Response("public app shell"),
  });

  let dispatched = dispatchFetch(worker, navigationRequest);
  let response = await dispatched.responsePromise;
  await dispatched.lifetimePromise;
  assert.equal(await response.text(), "public app shell");
  assert.deepEqual(worker.cacheWrites, [{ name: "diarium-v8", url: rootUrl }]);

  const offlineWorker = createWorker({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    cacheEntries: {
      "diarium-v8": [[rootUrl, new Response("cached public app shell")]],
    },
  });
  dispatched = dispatchFetch(offlineWorker, navigationRequest);
  response = await dispatched.responsePromise;
  await dispatched.lifetimePromise;
  assert.equal(await response.text(), "cached public app shell");
  assert.deepEqual(offlineWorker.cacheMatches, [{ name: "diarium-v8", url: rootUrl }]);

  const privateUrl = `${ORIGIN}/account/export.csv`;
  const privateWorker = createWorker({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    cacheEntries: {
      "diarium-v8": [[privateUrl, new Response("synthetic account A export")]],
    },
  });
  dispatched = dispatchFetch(privateWorker, new Request(privateUrl));
  await assert.rejects(dispatched.responsePromise, /network unavailable/);
  await dispatched.lifetimePromise;
  assert.equal(privateWorker.cacheMatches.length, 0);
  assert.equal(privateWorker.cacheWrites.length, 0);
});

test("service worker does not clear browser storage outside its own caches", () => {
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB)\b/);
});

test("activation removes only known prior Diarium caches and activates the worker", async () => {
  const worker = createWorker({
    fetchImpl: async () => new Response("unused"),
    cacheEntries: {
      "diarium-v8": [],
      "diarium-v1": [],
      "diarium-v2": [],
      "diarium-v3": [],
      "diarium-v4": [],
      "diarium-v5": [],
      "diarium-v6": [],
      "diarium-v7": [],
      "other-app-cache": [],
    },
  });

  worker.listeners.get("install")();
  let activationLifetime;
  worker.listeners.get("activate")({ waitUntil(promise) { activationLifetime = promise; } });
  await activationLifetime;

  assert.deepEqual(worker.deletedCaches, [
    "diarium-v1",
    "diarium-v3",
    "diarium-v4",
    "diarium-v5",
    "diarium-v6",
    "diarium-v7",
  ]);
  assert.deepEqual([...worker.cacheStore.keys()], ["diarium-v8", "diarium-v2", "other-app-cache"]);
  assert.deepEqual(worker.lifecycleCalls, ["skipWaiting", "clients.claim"]);
});

test("self-unregister removes only this app's known caches", async () => {
  const worker = createWorker({
    fetchImpl: async () => new Response("unused"),
    cacheEntries: {
      "diarium-v8": [],
      "diarium-v1": [],
      "diarium-v2": [],
      "diarium-v3": [],
      "diarium-v4": [],
      "diarium-v5": [],
      "diarium-v6": [],
      "diarium-v7": [],
      "other-app-cache": [],
    },
  });
  let messageLifetime;
  worker.listeners.get("message")({
    data: { type: "UNREGISTER_SELF" },
    waitUntil(promise) { messageLifetime = promise; },
  });
  await messageLifetime;

  assert.deepEqual(worker.deletedCaches, [
    "diarium-v8",
    "diarium-v1",
    "diarium-v3",
    "diarium-v4",
    "diarium-v5",
    "diarium-v6",
    "diarium-v7",
  ]);
  assert.deepEqual([...worker.cacheStore.keys()], ["diarium-v2", "other-app-cache"]);
  assert.deepEqual(worker.lifecycleCalls, ["skipWaiting", "registration.unregister"]);
});
