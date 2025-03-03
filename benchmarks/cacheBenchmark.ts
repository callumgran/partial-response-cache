import { PartialChunkCache } from "../src/partialChunkCache";

// UUIDs to use as cache keys
const UUIDS = [
  "c33af729-bc02-4e66-8243-b35a04d848a4",
  "edc31912-d898-4c51-8a27-0ba8325cf04b",
  "533ea3b1-ddb7-4b63-9f8e-2e9509a85f9a",
  "f3b86bd7-34e1-48b3-b0c2-f016cdb4a6e0",
  "28d3cd79-5ce0-46c6-865e-25117052c0c5",
  "94044e61-d7d5-4a5d-b8f7-0b6454238060",
  "c3dbf561-4c3b-4554-86b1-0c0a1ee96657",
  "f51d9168-7f94-465f-b66f-44c097540589",
  "9e414f54-b5bd-4207-9d16-0a3ae7896e28",
  "8733c897-9bff-4326-9655-9f5f6ea359dd",
  "01bf22e9-171d-42c3-8c61-7dab989e4469",
  "d05bfed6-9571-4836-a328-93377d921471",
  "48dde79e-4a1f-4f9a-b0f9-06a3eeb58d8e",
  "ddf8f2e6-f2db-4764-97fb-6ead96951e66",
  "9c17c5c1-5d5d-4907-a7c6-9fd7039f7227",
  "260dd589-7839-4b9e-b7bc-4352bad83a4c",
  "1450a761-01e1-4ad2-9480-e0032838371b",
  "142ec8c8-f740-47cf-a979-86cedad98945",
  "0968d024-21f9-4280-ad4a-ac6973fc7479",
  "cbc7210b-e6a8-4e14-bee7-619813398bf9",
  "63383d46-1105-44a3-8e43-9dfa61fc1ae6",
  "e6b288e9-f5c9-471e-b1cc-05af30dcbc48",
  "7e17ff29-a20a-461e-8f61-d16959a84a39",
  "4cb412cb-86b7-43ae-ad77-2f11316e7379",
  "8774fbe4-2495-4f37-9704-8798118db23e",
  "133ce72b-60df-47b0-8907-e152161579b2",
  "8a8b30af-d6fc-4bc4-bab2-8d055ab2d995",
  "a736f559-f7c1-4fab-91b8-6d3eba103a72",
  "cd036100-21e3-456d-b75d-77b6a4f19db5",
  "a9bb4ade-54b1-4ad3-95bd-d88ed5c6530c",
  "971ab6d4-318e-4064-9dc6-6fd9a0540344",
  "2b90b514-4b19-4258-910f-3542c087d2f8",
  "727ea28a-4d9d-44b8-aba4-9e4aeacbb6a6",
  "93efb8a7-32f3-494c-bc2a-8a3846c7b3b4",
  "ca031203-727a-4259-bec0-071bbd0b7890",
  "55840501-f912-4a01-ad98-5ee33858a2e6",
  "5928bbea-e083-49f8-bbc6-2db8d9584605",
  "f88baffc-52ae-4e8e-b0d7-5ca6c92471b0",
  "0ec72446-6b1e-4034-8252-3de14582a349",
  "8f0b5fd6-7367-4161-a29b-1a3c5b3d57f8",
  "20f53ec4-9f6f-4f2b-b42f-cd39bc66dd87",
  "aa11b004-4687-472c-bf00-75d2510c8def",
  "5c2fd8cf-270d-4b82-aaee-5bf1e25631e3",
  "4203cfb3-1e58-466a-8673-d88ff65334d0",
  "d72d75eb-b5be-445a-83bd-7f98af4515c6",
  "6ec5d7df-795e-4342-aabf-7b5ff112b843",
  "5f5e6b86-6f3b-4f1c-8d9e-fec29c4f49c8",
  "02ab0761-3993-4697-8a4c-ee9a4207247a",
  "b278ecc7-9c29-4c4e-b0dc-2cfe6699721d",
  "f50b6124-544d-4855-9a87-ca4f866967ae",
];

const TOTAL_OPS = 100000;
const WARMUP_OPS = 1000;
const CHUNK_SIZE = 1024 * 1024;
const MAX_CACHE_SIZE = 32;
const CACHE_CHUNKS_TOTAL_SIZE = 10 * CHUNK_SIZE;
const LAST_INSERTS_TRACKED = 100;

export async function benchmarkChunkCache() {
  const cache = new PartialChunkCache<string>(
    (key) => key,
    MAX_CACHE_SIZE,
    CHUNK_SIZE
  );
  
  const sampleData = new Blob([new Uint8Array(CHUNK_SIZE)], {
    type: "application/octet-stream",
  });

  let insertTimes: number[] = [];
  let lookupTimes: number[] = [];
  let misses = 0;
  let hits = 0;

  const lastInserts: { key: string; chunkIndex: number }[] = [];

  console.log("\n🔥 Warming up the cache...");
  for (let i = 0; i < WARMUP_OPS; i++) {
    const uuid = UUIDS[Math.floor(Math.random() * UUIDS.length)];
    const chunkIndex = Math.floor(Math.random() * 32) * CHUNK_SIZE;
    cache.cacheChunk(uuid, chunkIndex, sampleData, CACHE_CHUNKS_TOTAL_SIZE);

    lastInserts.push({ key: uuid, chunkIndex });
    if (lastInserts.length > LAST_INSERTS_TRACKED) lastInserts.shift();
  }

  console.log("\n🚀 Starting main benchmark...");
  for (let i = 0; i < TOTAL_OPS; i++) {
    const insertUUID = UUIDS[Math.floor(Math.random() * UUIDS.length)];
    const insertChunkIndex = Math.floor(Math.random() * 32) * CHUNK_SIZE;

    const startInsert = performance.now();
    cache.cacheChunk(
      insertUUID,
      insertChunkIndex,
      sampleData,
      CACHE_CHUNKS_TOTAL_SIZE
    );
    const endInsert = performance.now();
    insertTimes.push(endInsert - startInsert);

    lastInserts.push({ key: insertUUID, chunkIndex: insertChunkIndex });
    if (lastInserts.length > LAST_INSERTS_TRACKED) lastInserts.shift();

    const lookupEntry = lastInserts[Math.floor(Math.random() * lastInserts.length)];

    const startLookup = performance.now();
    const { buffers } = cache.getChunks(
      cache.values.get(lookupEntry.key)!,
      lookupEntry.chunkIndex,
      lookupEntry.chunkIndex + sampleData.size - 1
    );
    const endLookup = performance.now();

    if (buffers.length === 0) {
      misses++;
    } else {
      hits++;
    }
    lookupTimes.push(endLookup - startLookup);
  }

  console.log("\n📊 **Benchmark Results**:");
  console.log(`Total Operations: ${TOTAL_OPS}`);
  console.log(`Avg Insert Time: ${average(insertTimes).toFixed(3)} ms`);
  console.log(`Avg Lookup Time: ${average(lookupTimes).toFixed(3)} ms`);
  console.log(`Hit Rate: ${((hits / TOTAL_OPS) * 100).toFixed(2)}%`);
  console.log(`Miss Rate: ${((misses / TOTAL_OPS) * 100).toFixed(2)}%`);
}

function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
