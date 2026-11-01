/* Offline reading: the page and its code are kept for offline use, and every chapter you open is kept too,
   so it can be read again without a connection. New versions are fetched when online (the copy kept is
   refreshed in the background). The large Purana search files are not kept. */
const CACHE = "hl-v2";
const SHELL = [ "./", "index.html", "assets/app.js", "assets/features.js", "assets/app.css", "assets/icon.svg", "data/library.json", "manifest.webmanifest" ];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
	const r = e.request, u = new URL(r.url);
	if (r.method !== "GET") return;
	const same = u.origin === location.origin, font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
	if (!same && !font) return;
	if (same && /\/data\/search\/.*purana/.test(u.pathname)) return;   // too big to keep
	// network first, the kept copy when offline; what comes back is kept for next time
	e.respondWith(fetch(r).then((res) => {
		if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); }
		return res;
	}).catch(() => caches.match(r, { ignoreSearch: same && u.pathname.endsWith("/") }).then((m) => m || caches.match("index.html"))));
});
