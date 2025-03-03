import { benchmarkStreamingCache } from "./streamingBenchmark.ts";
import { benchmarkChunkCache } from "./cacheBenchmark.ts";

console.log("🔥 Streaming Cache Benchmark");
await benchmarkStreamingCache();

console.log("\n🔥 Chunk Cache Benchmark");
await benchmarkChunkCache();
