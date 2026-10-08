/**
 * hecz.dev service worker.
 *
 * Exists so the site is installable: the manifest and icons were already in
 * place, and a fetch handler is the last thing Chrome requires before it will
 * offer "Add to home screen".
 *
 * The caching strategy is deliberately conservative, because a service worker
 * is the classic way to ship an update that nobody can see:
 *
 *   - Navigations are NETWORK-FIRST. A deploy is never hidden behind a cache.
 *     The cached shell is only reached when the network actually fails, which
 *     is the offline case it exists for.
 *   - /assets/* is CACHE-FIRST, but only because Vite content-hashes those
 *     filenames. A changed file is a new URL, so a cached one can never be
 *     stale — it can only be garbage, which the version sweep below collects.
 *   - Everything else falls through to the network untouched. Supabase,
 *     analytics and the LuluDesk widget are cross-origin and never cached.
 */

const VERSION = "v2";
const SHELL = `tag-shell-${VERSION}`;
const ASSETS = `tag-assets-${VERSION}`;
/** Reached only when the network is gone. */
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([new Request(OFFLINE_URL, { cache: "reload" }), "/offline.js"]))
      // A failed precache must not wedge the install; the worker is still
      // useful for assets, and navigations just stay online-only.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("tag-") && k !== SHELL && k !== ASSETS)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: always try the network so a new deploy lands immediately.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        // Only the public chat shell is cached. Never cache private routes or shared tokens.
        if (url.pathname === "/" && response.ok && response.headers.get("content-type")?.includes("text/html")) {
          const copy = response.clone();
          event.waitUntil(caches.open(SHELL).then(cache => cache.put("/", copy)));
        }
        return response;
      }).catch(async () => (url.pathname === "/" ? await caches.match("/") : undefined) ?? await caches.match(OFFLINE_URL) ?? Response.error()),
    );
    return;
  }

  if (url.pathname === "/offline.js") {
    event.respondWith(caches.match(request).then(hit => hit ?? fetch(request)));
    return;
  }

  // Content-hashed build output: safe to serve from cache forever.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

/** Lets the page hand control to a waiting worker without a manual reload. */
self.addEventListener("message", (event) => {
  if (event.data === "hecz:skip-waiting") self.skipWaiting();
});
