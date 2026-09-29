import { Readable } from "node:stream";
import { assertSafePath, contentTypeFromPath, StorageAlreadyExistsError, StoragePreconditionError, type PutOptions, type StorageProvider } from "@/lib/storage/types";

/** Storage em memória para testes (mesma semântica de ETag/ifNotExists dos providers reais). */
export class MemoryStorageProvider implements StorageProvider {
  readonly driver = "local" as const;
  readonly supportsDirectUpload = false;
  private files = new Map<string, { body: Buffer; etag: string; contentType: string; at: Date }>();
  private counter = 0;

  async get(path: string) {
    assertSafePath(path);
    const f = this.files.get(path);
    return f ? { body: Buffer.from(f.body), contentType: f.contentType, etag: f.etag, size: f.body.length } : null;
  }

  async getStream(path: string) {
    const f = await this.get(path);
    if (!f) return null;
    return { stream: Readable.toWeb(Readable.from([f.body])) as ReadableStream<Uint8Array>, contentType: f.contentType, size: f.size, etag: f.etag };
  }

  async put(path: string, body: Buffer | Uint8Array | string, options: PutOptions) {
    assertSafePath(path);
    const current = this.files.get(path);
    if (options.ifNotExists && current) throw new StorageAlreadyExistsError(path);
    if (options.ifMatch !== undefined && current?.etag !== options.ifMatch) throw new StoragePreconditionError(path);
    const etag = `e${++this.counter}`;
    this.files.set(path, { body: Buffer.from(body), etag, contentType: options.contentType || contentTypeFromPath(path), at: new Date() });
    return { etag };
  }

  async delete(paths: string | string[]) {
    for (const p of Array.isArray(paths) ? paths : [paths]) this.files.delete(p);
  }

  async list(prefix: string) {
    return [...this.files.entries()].filter(([p]) => p.startsWith(prefix)).map(([p, f]) => ({ path: p, size: f.body.length, uploadedAt: f.at })).sort((a, b) => a.path.localeCompare(b.path));
  }

  async listFolders(prefix: string) {
    const set = new Set<string>();
    for (const p of this.files.keys()) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const i = rest.indexOf("/");
      if (i > 0) set.add(`${prefix}${rest.slice(0, i)}/`);
    }
    return [...set];
  }

  async copy(from: string, to: string, contentType: string) {
    const f = this.files.get(from);
    if (!f) throw new Error(`not found: ${from}`);
    await this.put(to, f.body, { contentType });
  }

  async exists(path: string) {
    return this.files.has(path);
  }

  paths() {
    return [...this.files.keys()];
  }
}
