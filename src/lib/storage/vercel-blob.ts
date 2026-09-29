import "server-only";
import { BlobNotFoundError, BlobPreconditionFailedError, copy, del, get, head, list, put } from "@vercel/blob";
import {
  assertSafePath,
  StorageAlreadyExistsError,
  StoragePreconditionError,
  type PutOptions,
  type StoredListing,
  type StorageProvider,
} from "./types";

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && /already exists/i.test(error.message);
}

/**
 * Vercel Blob com acesso privado: nenhum arquivo tem URL pública. Leitura sempre
 * pelo servidor (com token), que valida quem pode ver o quê antes de repassar.
 */
export class VercelBlobStorageProvider implements StorageProvider {
  readonly driver = "vercel-blob" as const;
  readonly supportsDirectUpload = true;

  constructor(private readonly token: string | undefined) {}

  private opts() {
    return this.token ? { token: this.token } : {};
  }

  async get(p: string) {
    assertSafePath(p);
    try {
      // useCache: false → documentos JSON mudam; nunca ler versão antiga do CDN.
      const res = await get(p, { access: "private", useCache: false, ...this.opts() });
      if (!res || res.statusCode !== 200) return null;
      const body = await streamToBuffer(res.stream);
      return { body, contentType: res.blob.contentType, etag: res.blob.etag, size: res.blob.size };
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
  }

  async getStream(p: string) {
    assertSafePath(p);
    try {
      const res = await get(p, { access: "private", ...this.opts() });
      if (!res || res.statusCode !== 200) return null;
      return { stream: res.stream, contentType: res.blob.contentType, size: res.blob.size, etag: res.blob.etag };
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
  }

  async put(p: string, body: Buffer | Uint8Array | string, options: PutOptions) {
    assertSafePath(p);
    try {
      const payload = typeof body === "string" ? body : Buffer.from(body);
      const res = await put(p, payload, {
        access: "private",
        contentType: options.contentType,
        addRandomSuffix: false,
        allowOverwrite: !options.ifNotExists,
        ifMatch: options.ifMatch,
        cacheControlMaxAge: 60,
        ...this.opts(),
      });
      return { etag: res.etag };
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) throw new StoragePreconditionError(p);
      if (options.ifNotExists && isAlreadyExists(e)) throw new StorageAlreadyExistsError(p);
      throw e;
    }
  }

  async delete(paths: string | string[]) {
    const list_ = (Array.isArray(paths) ? paths : [paths]).map(assertSafePath);
    if (list_.length) await del(list_, this.opts());
  }

  async list(prefix: string): Promise<StoredListing[]> {
    const out: StoredListing[] = [];
    let cursor: string | undefined;
    do {
      const res = await list({ prefix, cursor, limit: 1000, ...this.opts() });
      for (const b of res.blobs) out.push({ path: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt) });
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);
    return out;
  }

  async listFolders(prefix: string): Promise<string[]> {
    const folders: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await list({ prefix, cursor, mode: "folded", limit: 1000, ...this.opts() });
      folders.push(...res.folders);
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);
    return folders;
  }

  async copy(from: string, to: string, contentType: string) {
    assertSafePath(from);
    assertSafePath(to);
    await copy(from, to, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true, ...this.opts() });
  }

  async exists(p: string) {
    assertSafePath(p);
    try {
      await head(p, this.opts());
      return true;
    } catch (e) {
      if (e instanceof BlobNotFoundError) return false;
      throw e;
    }
  }
}
