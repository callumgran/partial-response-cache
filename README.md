# PartialResponseCache

A service worker that enables partial response caching for streaming.

## Why is this useful and when should I use it?

In most cases when you stream data, you will only ever look at it once. However, in some cases you might switch between data streams. This could be rewatching different videos, streaming audio, etc. In these cases, it is useful to cache the data that you have already seen so that you don't have to re-download it.

## Installation

```sh
npm install partial-response-cache
```

## Usage

The `PartialResponseCache` class is used in a service worker to cache partial responses. The constructor takes three arguments:

1. `keyFunc`: A function that takes a string and returns a key that is used to identify the response. This key is used to store the many response chunks in the cache.
2. `maxCacheSize`: The maximum number of chunks to store in the cache.
3. `chunkSize`: The size of each chunk that will be in each cache line. This should be equal to the size of the chunks that are being streamed, although they can be any size really, it's just a cap.

```js
import { PartialResponseCache } from "partial-response-cache";

const partialResponseCache = new PartialResponseCache(
  (url) => new URL(url).searchParams.get("id") || "",
  32,
  1024 * 1024
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
    event.respondWith(partialResponseCache.handleRequest(event.request));
  }
});
```

### How do I know if it's working?

When requesting from the backend you will see in the network tab that each request will take anywhere from 200ms to 1s. When you have the service worker running, the first request will take the same amount of time, but subsequent requests will be almost instant, around 2-10ms depending on your machine. This will still show in the network tab because the service worker intercepts the request, but if you want you can use the `Offline` option in the network tab to see that you still get data even when offline.

## API

### `new PartialResponseCache(keyFunc, maxCacheSize, chunkSize)`

Creates a partial response cache to handle streamed requests.

- **`keyFunc: (url: string) => string`**  
  Function that extracts a key (e.g., a UUID) to identify cached responses.
- **`maxCacheSize: number`**  
  Maximum number of cached response chunks.
- **`chunkSize: number`**  
  Size (in bytes) of each cached chunk.

### `handleRequest(request: Request): Promise<Response>`

Handles incoming requests and returns a cached or streamed response.

- **`request: Request`**  
  Request to handle.

## Inner workings

The `PartialResponseCache` class acts as a wrapper around an underlying cache, which is implemented in `PartialChunkCache`. The `PartialChunkCache` class is a Least Recently Used (LRU) cache that stores and manages response chunks. This caching mechanism is designed to reduce redundant network requests when streaming data. It ensures that previously retrieved parts of a file (e.g., audio or video segments) can be reused when the same resource is accessed again.

### `PartialChunkCache`

The `PartialChunkCache` class maintains a map of cache entries, where each entry (cache line) stores multiple chunks of a response. 

### Cache Data Structure 
Each cached response consists of a cache line, represented by:

```ts
interface CacheLine { 
  chunks: Map<number, Blob>; // Maps chunk start index → chunk data
  sortedKeys: number[]; // Sorted list of chunk start indexes 
  totalSize: number; // Total size of the resource being cached 
}
```
Why do we have a sorted list of keys? Chunks don't necessarily arrive in order and by keeping a sorted list of keys, we can quickly find the chunks that overlap with a given byte range. It just makes things easier, although it does add some overhead.

### Core Functions

| Function                                                                                              | Purpose                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `getCacheLine(key: T): CacheLine \| undefined`                                                        | Retrieves the cache line for a given key, updating its LRU priority.                      |
| `cacheChunk(key: T, chunkIndex: number, buffer: Blob, totalSize: number): void`                       | Stores a chunk in the cache and manages LRU eviction if the cache exceeds `maxCacheSize`. |
| `getChunks(cacheLine: CacheLine, start: number, end: number): { indexes: number[], buffers: Blob[] }` | Retrieves the cached chunks that overlap with the requested byte range.                   |

### LRU Caching Strategy

- The `lruQueue` maintains the order of cache usage.
- When a new chunk is cached:
  - The corresponding cache entry is moved to the end of `lruQueue`.
  - If the cache exceeds `maxCacheSize`, the least recent entry is removed.
  - It's worth noting that the LRU works on full cache lines, not individual chunks. Once a cache line is evicted, all chunks within it are removed.

### `PartialResponseCache`

`PartialResponseCache` extends `PartialChunkCache` and is responsible for:

- Intercepting HTTP requests
- Extracting `Range` headers
- Checking the cache before fetching from the network
- Building partial responses from cached data

### Request Handling Process

#### 1. Intercepts the `fetch` event in the service worker:

```js
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/stream")) {
    event.respondWith(partialResponseCache.handleRequest(event.request));
  }
});
```

#### 2. Processes the Request via `handleRequest(request)`, which: 
- If a `Range` header is not present, performs a normal fetch. 
- If a `Range` header exists, calls `serveChunks(...)`. 

#### 3. Retrieves Cached Chunks 
- The method `serveChunks(rangeHeader, request)`: 
- Parses the byte range from the request. 
- Retrieves matching cached chunks via `getChunks(...)`. 
- If chunks exist, calls `buildResponse(...)`. 
- Otherwise, fetches missing data via `fetchAndCache(request)`. 

#### 4. Fetches & Caches Missing Chunks 
- If a requested range is not fully cached, `fetchAndCache(request)`: 
- Fetches the missing range from the server. 
- Extracts byte range information from the `Content-Range` header. 
- Stores the new chunk using `cacheChunk(...)`. 

#### 5. Builds & Returns Partial Responses 
- The method `buildResponse(...)`: 
- If only one chunk is required, returns it directly. 
- Otherwise, merges multiple chunks into a `Blob` and slices it to match the exact range. 
- Responds with HTTP 206 Partial Content. 

---
### Example Workflow 
#### 🎵 Scenario: Streaming an Audio File 
- A client requests bytes 0-5000 of `/api/stream?id=1234`. 
1. Checks if the requested range exists in cache. 
2. If cached, returns the cached response. 
3. If not cached, fetches from the network and stores it. 
4. Future requests for overlapping byte ranges reuse cached data. 


## Testing

Currently there are no tests, this will be added in the near future.

## Optimizations

The astute programmer may realize that I have suboptimal asymptotic complexity in my code. For example:

```ts
for (let i = 0; i < cacheLine.sortedKeys.length; i++) {
  const chunkStart = cacheLine.sortedKeys[i];
  if (chunkStart > end) break;

  const buffer = cacheLine.chunks.get(chunkStart);
  if (!buffer) continue;

  const chunkEnd = chunkStart + buffer.size - 1;
  if (chunkStart <= end && chunkEnd >= start) {
    responseChunks.push(buffer);
    responseIndexes.push(chunkStart);
  }
}
```

The list of keys is sorted, so we can use a binary search to find the first key before looping, which would reduce complexity from `O(n)` to `O(log n)`. However, I have not implemented this because the number of chunks in a cache line will usually be so small that the overhead of calling a function would outweigh its benefits.\

If you are planning to use this package and expect to have many hundreds of chunks per cache line, I would recommend going through the code and implementing optimizations like this. In the future this package may be updated to include different implementations of this base cache, which could be passed as a parameter.
