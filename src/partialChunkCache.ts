interface CacheLine {
  chunks: Map<number, Blob>;
  sortedKeys: number[];
  totalSize: number;
}

export class PartialChunkCache<T> {
  private keyFunc: (key: T) => string;
  private values: Map<string, CacheLine>;
  private lruQueue: string[];
  private maxCacheSize: number;

  constructor(
    keyFunc: (key: T) => string,
    maxCacheSize: number = 32
  ) {
    this.keyFunc = keyFunc;
    this.values = new Map();
    this.lruQueue = [];
    this.maxCacheSize = maxCacheSize;
  }

  protected getKey(key: T): string {
    return this.keyFunc(key);
  }

  protected getCacheLine(key: T): CacheLine | undefined {
    const cacheKey = this.getKey(key);
    this.lruQueue = this.lruQueue.filter((k) => k !== cacheKey);
    this.lruQueue.push(cacheKey);
    return this.values.get(cacheKey);
  }

  protected cacheChunk(
    key: T,
    chunkIndex: number,
    buffer: Blob,
    totalSize: number
  ): void {
    const cacheKey = this.getKey(key);
    let cacheLine = this.values.get(cacheKey);

    if (!cacheLine) {
      cacheLine = {
        chunks: new Map(),
        sortedKeys: [],
        totalSize,
      };
      this.values.set(cacheKey, cacheLine);
    }

    if (!cacheLine.chunks.has(chunkIndex)) {
      cacheLine.sortedKeys.push(chunkIndex);
      cacheLine.sortedKeys.sort((a, b) => a - b);
    }

    cacheLine.chunks.set(chunkIndex, buffer);

    const index = this.lruQueue.indexOf(cacheKey);
    if (index !== -1) this.lruQueue.splice(index, 1);
    this.lruQueue.push(cacheKey);

    if (this.lruQueue.length > this.maxCacheSize) {
      this.values.delete(this.lruQueue.shift()!);
    }
  }

  protected getChunks(
    cacheLine: CacheLine,
    start: number,
    end: number
  ): { indexes: number[]; buffers: Blob[] } {
    if (!cacheLine) return { indexes: [], buffers: [] };

    let responseIndexes: number[] = [];
    let responseChunks: Blob[] = [];
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

    if (responseChunks.length === 0) return { indexes: [], buffers: [] };

    const firstChunkIdx = responseIndexes[0];
    const lastChunkIdx =
      responseIndexes[responseIndexes.length - 1] +
      responseChunks[responseChunks.length - 1].size -
      1;

    const responseStart = Math.max(firstChunkIdx, start);
    const responseEnd = Math.min(lastChunkIdx, end);
    const responseSize = responseEnd - responseStart + 1;

    if (responseSize < end - start + 1) {
      return { indexes: [], buffers: [] };
    }

    return { indexes: responseIndexes, buffers: responseChunks };
  }
}
