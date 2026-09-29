import { describe, expect, it, vi } from "vitest";

// Simula o SDK: resposta comprimida com ETag fraco, como o Blob faz com JSONs maiores.
const calls: Array<{ fn: string; headers?: unknown }> = [];
vi.mock("@vercel/blob", () => {
  class BlobError extends Error {}
  return {
    BlobNotFoundError: class extends BlobError {},
    BlobPreconditionFailedError: class extends BlobError {},
    get: vi.fn(async (_p: string, opts: { headers?: unknown }) => {
      calls.push({ fn: "get", headers: opts.headers });
      return {
        statusCode: 200,
        stream: new Response('{"n":1}').body,
        headers: new Headers(),
        blob: { contentType: "application/json", size: 7, etag: 'W/"abc123"' },
      };
    }),
    head: vi.fn(async () => {
      calls.push({ fn: "head" });
      return { etag: '"abc123"' };
    }),
    put: vi.fn(),
    del: vi.fn(),
    list: vi.fn(),
    copy: vi.fn(),
  };
});

describe("VercelBlobStorageProvider — ETag", () => {
  it("pede resposta sem compressão e troca ETag fraco pelo forte (exigido pelo ifMatch)", async () => {
    const { VercelBlobStorageProvider } = await import("@/lib/storage/vercel-blob");
    const s = new VercelBlobStorageProvider("token-de-teste");
    const obj = await s.get("clients/cl_abc123def456/index.json");
    expect(obj?.etag).toBe('"abc123"');
    expect(obj?.body.toString()).toBe('{"n":1}');
    expect(calls[0]).toEqual({ fn: "get", headers: { "accept-encoding": "identity" } });
    expect(calls.some((c) => c.fn === "head")).toBe(true);
  });
});
