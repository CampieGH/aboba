const VERSION_ID = 2;
const CACHE_PREFIX = "aboba-";
const CACHE_NAME = `${CACHE_PREFIX}v${VERSION_ID}`;

const cachedList = [
    "/index.html",
    "/index.css",
    "/app.js",
    "/auth.js",
    "/firebase-config.js",
    "/globals.js",
    "/input.js",
    "/manifest.json",
    "/splash.js",
    "/storage.js",
    "/util.js"
];

async function populateCache(resources) {
    const localCache = await caches.open(CACHE_NAME);
    await localCache.addAll(resources);
}

async function cleanCache() {
    const keyList = await caches.keys();
    const oldAppCaches = keyList.filter(
        (key) => key === "v1" || (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    );
    await Promise.all(oldAppCaches.map((key) => caches.delete(key)));
}

self.addEventListener("install", (event) => {
    event.waitUntil(populateCache(cachedList));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(cleanCache().then(() => self.clients.claim()));
});

async function fetchHandler(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    try {
        return await fetch(request);
    } catch (error) {
        console.debug(`Fetch failed: ${error}`);
        return new Response("Сеть недоступна", { status: 503 });
    }
}

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    event.respondWith(fetchHandler(event.request));
});
