// Minimal service worker: exists to make Mizan installable as a PWA.
// Deliberately NO caching of app routes or Next.js chunks — financial figures
// must always be live, and cached chunks break on deploys. Network-first
// everything; only the static PWA icons are cached.
const ICON_CACHE = "mizan-icons-v1";
const ICONS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ICON_CACHE).then((cache) => cache.addAll(ICONS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== ICON_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request)),
    );
  }
  // everything else: straight to the network (browser default)
});
