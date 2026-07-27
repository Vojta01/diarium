const CACHE = "diarium-v6";
const FETCH_TIMEOUT_MS = 8000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "UNREGISTER_SELF") {
    // Graceful self-unregister: skip waiting, delete all caches, unregister
    self.skipWaiting();
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => {
      self.registration.unregister();
    });
  }
});

/**
 * Fetch with a timeout. If the network request exceeds the timeout,
 * fall back to the cache (if available) or return a minimal offline page.
 */
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    fetch(request, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Minimal offline fallback HTML — shown when network-first timeout
 * fires for a navigation request and no cache is available.
 * Links to /sw-reset so the user can recover.
 */
const OFFLINE_FALLBACK_HTML =
  '<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diarium — offline</title><style>body{background:#0f0f23;color:#a5b4fc;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}a{color:#6366f1;text-decoration:underline}</style></head><body><div><p>Aplikace je momentálně offline.</p><p style="margin-top:1rem;font-size:0.85rem;color:rgba(165,180,252,0.5)">Zkus <a href="/sw-reset">obnovit aplikaci</a> nebo to zopakuj později.</p></div></body></html>';

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // NEVER cache auth-related pages — they must always hit the network
  if (url.pathname.startsWith("/auth/") || url.pathname === "/sw-reset") {
    event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_FALLBACK_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })));
    return;
  }

  // For everything else: network-first with timeout, cache as fallback
  event.respondWith(
    fetchWithTimeout(event.request, FETCH_TIMEOUT_MS)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, show offline fallback
          if (event.request.mode === "navigate") {
            return new Response(OFFLINE_FALLBACK_HTML, {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }
          return new Response("Offline", { status: 503 });
        })
      )
  );
});

// --- PUSH NOTIFICATIONS ---
self.addEventListener("push", (event) => {
  let data = { title: "Diarium", body: "Nezapomeň vyplnit dnešní záznam! 🖊️" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      tag: "diarium-reminder",
      requireInteraction: true,
      data: { url: "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/");
    })
  );
});
