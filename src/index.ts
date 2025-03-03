import { PartialChunkCache } from "./partialChunkCache";

export class StreamingCache extends PartialChunkCache<string> {
  constructor(
    keyFunc: (key: string) => string,
    maxCacheSize: number = 32,
    chunkSize: number = 1024 * 1024
  ) {
    super(keyFunc, maxCacheSize, chunkSize);
  }

  async handleRequest(request: Request): Promise<Response> {
    const rangeHeader = request.headers.get("Range");
    return rangeHeader
      ? this.serveChunks(rangeHeader, request)
      : fetch(request);
  }

  private async serveChunks(
    rangeHeader: string,
    request: Request
  ): Promise<Response> {
    const [unit, range] = rangeHeader.split("=");
    if (unit !== "bytes") return new Response(null, { status: 416 });

    const [startStr, endStr] = range.split("-");
    const requestedStart = parseInt(startStr, 10);
    const requestedEnd = endStr
      ? parseInt(endStr, 10)
      : requestedStart + this.chunkSize - 1;

    const url = request.url;

    const cacheLine = this.getCacheLine(url);
    if (!cacheLine) return this.fetchAndCache(request);

    const responseEnd = Math.min(requestedEnd, cacheLine.totalSize - 1);
    const { indexes, buffers } = this.getChunks(
      cacheLine,
      requestedStart,
      responseEnd
    );
    
    if (buffers.length > 0) {
        return this.buildResponse(indexes, buffers, requestedStart, responseEnd, cacheLine.totalSize);
    }

    return this.fetchAndCache(request);
  }

  private async fetchAndCache(request: Request): Promise<Response> {
    const response = await fetch(request);

    if (response.status !== 206) return response;

    const contentType =
      response.headers.get("Content-Type") || "application/octet-stream";
    const contentRange = response.headers.get("Content-Range");

    if (!contentRange) return new Response(null, { status: 416 });

    const [rangePart, totalSizeStr] = contentRange.split("/");
    const [rangeStartStr, rangeEndStr] = rangePart.split(" ")[1].split("-");
    const actualStart = parseInt(rangeStartStr, 10);
    const actualEnd = parseInt(rangeEndStr, 10);
    const totalSize = parseInt(totalSizeStr, 10);

    const buffer = await response.blob();

    this.cacheChunk(request.url, actualStart, buffer, totalSize);

    return new Response(buffer, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Range": `bytes ${actualStart}-${actualEnd}/${totalSize}`,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      },
    });
  }

  private buildResponse(
    indexes: number[],
    buffers: Blob[],
    start: number,
    end: number,
    totalSize: number
  ): Response {
    if (
      buffers.length === 1 &&
      start === indexes[0] &&
      end === indexes[0] + buffers[0].size - 1
    ) {
      return new Response(buffers[0], {
        status: 206,
        statusText: "Partial Content",
        headers: {
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Type": buffers[0].type,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const slicedBlob =
      buffers.length === 1
        ? buffers[0].slice(start - indexes[0], end - indexes[0] + 1)
        : new Blob(buffers).slice(start - indexes[0], end - indexes[0] + 1);

    return new Response(slicedBlob, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Type": slicedBlob.type,
        "Accept-Ranges": "bytes",
      },
    });
  }
}
