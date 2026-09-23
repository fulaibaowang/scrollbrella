// Offline support: every app file is saved on the device at install time
// and served from there, so the app opens instantly with or without a
// connection. Bump VERSION on every release so phones fetch the new files;
// the update is picked up in the background and shows on the next launch.
const VERSION = "v2";
const CACHE = `scrollbrella-${VERSION}`;

const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-180-v2.png",
  "icons/icon-192-v2.png",
  "icons/icon-512-v2.png",
  "audio/gymnopedie-1-v2.m4a",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Bypass the HTTP cache so a new version never saves stale files.
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(respond(req));
});

async function respond(req) {
  const cache = await caches.open(CACHE);
  const isPage = req.mode === "navigate";
  const cached = await cache.match(req, { ignoreSearch: isPage });

  if (cached) {
    const range = req.headers.get("range");
    return range ? rangeResponse(cached, range) : cached;
  }
  try {
    return await fetch(req);
  } catch (err) {
    // Offline and not saved: fall back to the app itself for page loads.
    if (isPage) return cache.match("./");
    throw err;
  }
}

// iOS Safari requests audio in byte ranges and won't play a full 200
// response, so slice the saved file into the 206 it expects.
async function rangeResponse(full, rangeHeader) {
  const buf = await full.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader) || [];
  let start = m[1] ? Number(m[1]) : 0;
  let end = m[2] ? Number(m[2]) : size - 1;
  if (!m[1] && m[2]) {
    // "bytes=-N" means the last N bytes
    start = size - Number(m[2]);
    end = size - 1;
  }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "audio/mp4",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}
