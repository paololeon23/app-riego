/* APP RIEGO — Service Worker
 * - Sin internet: app completa desde caché
 * - Con datos móviles: NO re-descarga si ya está en caché (ahorra megas)
 * - Actualización: solo al instalar nueva versión del SW (Wi‑Fi recomendado)
 */
const CACHE = "qb-riego-v302";
const ASSETS = [
  "./",
  "./index.html",
  "./install.html",
  "./css/fonts.css",
  "./css/styles.css",
  "./js/config.js",
  "./js/catalog-seed.js",
  "./js/data.js",
  "./js/valvular-data.js",
  "./js/aforos-parse.js",
  "./js/scoring.js",
  "./js/select.js",
  "./js/api.js",
  "./js/app.js",
  "./manifest.json",
  "./assets/logo-qberries.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/qr-install.png",
  "./data/lotes-licapa.json",
  "./data/trabajadores.json",
  "./data/supervisores-cosecha.json",
  "./data/evaluadores.json",
  "./fonts/plus-jakarta-sans-500.woff2",
  "./fonts/plus-jakarta-sans-600.woff2",
  "./fonts/plus-jakarta-sans-700.woff2",
  "./fonts/plus-jakarta-sans-800.woff2",
];

async function precacheAll_() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    ASSETS.map(async (path) => {
      try {
        const res = await fetch(path, { cache: "reload" });
        if (res && res.ok) await cache.put(path, res.clone());
      } catch (_) {}
    })
  );
}

function isNavigate_(req) {
  if (req.mode === "navigate") return true;
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/html");
}

async function matchCache_(req) {
  const exact = await caches.match(req);
  if (exact) return exact;
  // Con ?v=183 el path cambia: intentar sin query
  try {
    const url = new URL(req.url);
    if (url.search) {
      const bare = await caches.match(url.pathname + url.hash);
      if (bare) return bare;
      const rel = "." + url.pathname + url.search;
      const relHit = await caches.match(rel);
      if (relHit) return relHit;
      const noQ = await caches.match("." + url.pathname);
      if (noQ) return noQ;
    }
  } catch (_) {}
  if (!isNavigate_(req)) return null;
  return (
    (await caches.match("./index.html")) ||
    (await caches.match("/index.html")) ||
    (await caches.match("./")) ||
    null
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAll_().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE && k.startsWith("qb-riego-"))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // POST a Google Sheets / otros orígenes: no interceptar
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await matchCache_(req);

      // 1) Si hay caché → servir YA (0 megas). Crítico en campo.
      if (cached) return cached;

      // 2) Sin caché: intentar red y guardar
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (_) {
        if (isNavigate_(req)) {
          const fallback =
            (await caches.match("./index.html")) ||
            (await caches.match("/index.html"));
          if (fallback) return fallback;
        }
        return new Response(
          "Sin conexión. Abre la app una vez con Wi‑Fi para guardar los archivos.",
          {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }
        );
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (let i = 0; i < clients.length; i++) {
        const c = clients[i];
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "qb-flush-pending") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      clients.forEach((c) => c.postMessage({ type: "QB_FLUSH" }));
    })
  );
});
