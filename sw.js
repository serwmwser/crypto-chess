const CACHE_NAME = "crypto-chess-v3";
const APP_SHELL = ["", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

function appUrl(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map(appUrl)))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("crypto-chess-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;
  if (
    requestUrl.pathname.includes("/src/") ||
    requestUrl.pathname.includes("/@vite/") ||
    requestUrl.pathname.includes("/@react-refresh")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedPage = await caches.match(appUrl("index.html"));
        if (cachedPage) return cachedPage;
        return Response.error();
      })
    );
    return;
  }

  if (!request.destination) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
