import { StreamingCache } from "../src/index.ts";

const UUIDS = [
  "c33af729-bc02-4e66-8243-b35a04d848a4",
  "edc31912-d898-4c51-8a27-0ba8325cf04b",
  "533ea3b1-ddb7-4b63-9f8e-2e9509a85f9a",
  "f3b86bd7-34e1-48b3-b0c2-f016cdb4a6e0",
  "28d3cd79-5ce0-46c6-865e-25117052c0c5",
  "94044e61-d7d5-4a5d-b8f7-0b6454238060",
];

const TOTAL_OPS = 1000;
const CHUNK_SIZE = 1024 * 1024;
const MAX_CACHE_SIZE = 32;
const CACHE_CHUNKS_TOTAL_SIZE = 5 * CHUNK_SIZE;
let misses = 0;

(globalThis as any).fetch = async (request: Request) => {
  misses++;
  await new Promise((resolve) => setTimeout(resolve, 0));
  const rangeHeader = request.headers.get("Range");
  const rangeStart = parseInt(rangeHeader!.split("=")[1].split("-")[0]);
  const rangeEnd = parseInt(rangeHeader!.split("=")[1].split("-")[1]);
  return new Response(new Uint8Array(CHUNK_SIZE), {
    status: 206,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Range": `bytes ${rangeStart}-${rangeEnd}/${CACHE_CHUNKS_TOTAL_SIZE}`,
    },
  });
};

export async function benchmarkStreamingCache() {
  const cache = new StreamingCache(
    (url) => new URL(url).searchParams.get("uuid") || "",
    MAX_CACHE_SIZE,
    CHUNK_SIZE
  );

  let fetchTimes: number[] = [];
  let cacheTimes: number[] = [];

  console.log("\n🚀 Starting main benchmark...");
  
  let prevMisses = misses;
  for (let i = 0; i < TOTAL_OPS; i++) {
    const uuid = UUIDS[Math.floor(Math.random() * UUIDS.length)];
    const url = `https://example.com/api/audio?uuid=${uuid}`;

    const rangeStart = Math.floor(Math.random() * 5) * CHUNK_SIZE;
    const rangeEnd = Math.min(
      rangeStart + CHUNK_SIZE - 1,
      CACHE_CHUNKS_TOTAL_SIZE - 1
    );

    const request = new Request(url, {
      headers: { Range: `bytes=${rangeStart}-${rangeEnd}` },
    });

    const start = performance.now();
    await cache.handleRequest(request);
    const end = performance.now();

    const isCacheHit = prevMisses === misses;
    const elapsed = end - start;
    if (isCacheHit) {
      cacheTimes.push(elapsed);
    } else {
      fetchTimes.push(elapsed);
    }
    prevMisses = misses;
  }

  console.log("\n📊 **Benchmark Results**:");
  console.log(`Total Requests: ${TOTAL_OPS}`);
  console.log(
    `Cache Hits: ${TOTAL_OPS - misses} (${(
      ((TOTAL_OPS - misses) / TOTAL_OPS) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `Cache Misses: ${misses} (${((misses / TOTAL_OPS) * 100).toFixed(2)}%)`
  );
  console.log(
    `Avg Response Time (Cache Hits): ${average(cacheTimes).toFixed(3)} ms`
  );
  console.log(
    `Avg Response Time (Fetch): ${average(fetchTimes).toFixed(3)} ms`
  );
  console.log(
    `Throughput: ${(
      (TOTAL_OPS / sum([...cacheTimes, ...fetchTimes])) *
      1000
    ).toFixed(2)} requests/sec`
  );
}

function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
