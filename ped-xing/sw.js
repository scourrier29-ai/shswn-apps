/* Crosswalk PWA service worker — cache-first for the shell, network for /api */
const CACHE = "xw-shell-v2";
const SHELL = [
  "/", "/index.html", "/manifest.json",
  "/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-180.png",
  "/icons/gemini.svg", "/icons/gpt-oss.svg", "/icons/qwen.svg",
  "/icons/mistral.svg", "/icons/ollama.svg", "/icons/grok.svg",
  "/icons/muse.svg", "/icons/lapis.svg", "/icons/courtroom.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) {
    // API: network only — never serve stale model responses
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match("/index.html")))
  );
});
