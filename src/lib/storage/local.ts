import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import {
  assertSafePath,
  assertSafePrefix,
  contentTypeFromPath,
  StorageAlreadyExistsError,
  StoragePreconditionError,
  type PutOptions,
  type StoredListing,
  type StorageProvider,
} from "./types";

/**
 * Armazenamento em disco para desenvolvimento local (não é window.localStorage).
 * Não use em produção serverless: o filesystem da Vercel é efêmero.
 */
export class LocalFileStorageProvider implements StorageProvider {
  readonly driver = "local" as const;
  readonly supportsDirectUpload = false;
  private readonly root: string;
  private locks = new Map<string, Promise<unknown>>();

  constructor(rootDir: string) {
    this.root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rootDir);
  }

  private resolve(p: string): string {
    assertSafePath(p);
    const full = path.resolve(/*turbopackIgnore: true*/ this.root, ...p.split("/"));
    if (!full.startsWith(this.root + path.sep)) throw new Error("Caminho fora do diretório de dados.");
    return full;
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.locks.set(
      key,
      next.catch(() => undefined),
    );
    try {
      return await next;
    } finally {
      if (this.locks.get(key) === next) this.locks.delete(key);
    }
  }

  private etagOf(s: { mtimeMs: number; size: number }): string {
    return `${Math.floor(s.mtimeMs)}-${s.size}`;
  }

  async get(p: string) {
    const full = this.resolve(p);
    try {
      const [body, s] = await Promise.all([readFile(full), stat(full)]);
      return { body, contentType: contentTypeFromPath(p), etag: this.etagOf(s), size: s.size };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async getStream(p: string) {
    const full = this.resolve(p);
    try {
      const s = await stat(full);
      const stream = Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>;
      return { stream, contentType: contentTypeFromPath(p), size: s.size, etag: this.etagOf(s) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async put(p: string, body: Buffer | Uint8Array | string, options: PutOptions) {
    const full = this.resolve(p);
    return this.withLock(full, async () => {
      let current: { mtimeMs: number; size: number } | null = null;
      try {
        current = await stat(full);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      if (options.ifNotExists && current) throw new StorageAlreadyExistsError(p);
      if (options.ifMatch !== undefined && (!current || this.etagOf(current) !== options.ifMatch)) {
        throw new StoragePreconditionError(p);
      }
      await mkdir(path.dirname(full), { recursive: true });
      const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, body);
      await rename(tmp, full);
      const s = await stat(full);
      return { etag: this.etagOf(s) };
    });
  }

  async delete(paths: string | string[]) {
    for (const p of Array.isArray(paths) ? paths : [paths]) {
      await rm(this.resolve(p), { force: true });
    }
  }

  async list(prefix: string): Promise<StoredListing[]> {
    const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const dir = base ? this.resolve(base) : this.root;
    const out: StoredListing[] = [];
    const walk = async (d: string, rel: string) => {
      let entries;
      try {
        entries = await readdir(d, { withFileTypes: true });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
        throw e;
      }
      for (const entry of entries) {
        if (entry.name.endsWith(".tmp")) continue;
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        const childFull = path.join(d, entry.name);
        if (entry.isDirectory()) await walk(childFull, childRel);
        else {
          const s = await stat(childFull);
          out.push({ path: childRel, size: s.size, uploadedAt: s.mtime });
        }
      }
    };
    await walk(dir, base);
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  async listFolders(prefix: string): Promise<string[]> {
    const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    try {
      const entries = await readdir(this.resolve(base), { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => `${base}/${e.name}/`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }

  async copy(from: string, to: string) {
    const src = this.resolve(from);
    const dst = this.resolve(to);
    await mkdir(path.dirname(dst), { recursive: true });
    await copyFile(src, dst);
  }

  async exists(p: string) {
    try {
      await stat(this.resolve(p));
      return true;
    } catch {
      return false;
    }
  }

  async deletePrefix(prefix: string) {
    assertSafePrefix(prefix);
    const count = (await this.list(prefix)).length;
    await rm(this.resolve(prefix.slice(0, -1)), { recursive: true, force: true });
    return count;
  }
}
