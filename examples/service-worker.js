import { PartialResponseCache } from "partial-response-cache";

const partialResponseCache = new PartialResponseCache(
  (url) => new URL(url).searchParams.get("id") || "",
  32, // Number of cachelines. As each cacheline can be arbitrarily large, ensure that you don't cache too many items.
  1024 * 1024 // Recommend that this matches the response size from the server
);

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    self.clients.claim();
});


self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/stream")) {
	// This will handle the request and cache the response.
	// Subsequent requests will be served from the cache if it exists.
	// If the request start and end doesn't match the cache, it will
	// try to build the response from chunks in the cache.
    event.respondWith(cache.handleRequest(partialResponseCache.request));
  }
});
