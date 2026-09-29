import "server-only";
import type { z } from "zod";
import { ConflictError } from "@/lib/errors";
import { StoragePreconditionError, type StorageProvider } from "./types";

export interface Versioned<T> {
  data: T;
  etag: string;
}

export class CorruptDocumentError extends Error {
  constructor(public readonly path: string, detail: string) {
    super(`Documento inválido em ${path}: ${detail}`);
    this.name = "CorruptDocumentError";
  }
}

export async function readJSON<S extends z.ZodType>(storage: StorageProvider, path: string, schema: S): Promise<Versioned<z.output<S>> | null> {
  const obj = await storage.get(path);
  if (!obj) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(obj.body.toString("utf8"));
  } catch {
    throw new CorruptDocumentError(path, "JSON malformado");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new CorruptDocumentError(path, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return { data: parsed.data, etag: obj.etag };
}

export async function writeJSON(
  storage: StorageProvider,
  path: string,
  data: unknown,
  options: { ifMatch?: string; ifNotExists?: boolean } = {},
): Promise<string> {
  const { etag } = await storage.put(path, JSON.stringify(data, null, 2), {
    contentType: "application/json",
    ...options,
  });
  return etag;
}

/**
 * Leitura-modificação-escrita com controle otimista (ETag). Em caso de escrita
 * concorrente, relê e reaplica `mutate` algumas vezes antes de desistir.
 */
export async function updateJSON<S extends z.ZodType>(
  storage: StorageProvider,
  path: string,
  schema: S,
  mutate: (current: z.output<S> | null) => z.output<S>,
  options: { retries?: number } = {},
): Promise<z.output<S>> {
  const retries = options.retries ?? 4;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const current = await readJSON(storage, path, schema);
    const next = schema.parse(mutate(current ? current.data : null)) as z.output<S>;
    try {
      if (current) await writeJSON(storage, path, next, { ifMatch: current.etag });
      else await writeJSON(storage, path, next, { ifNotExists: true });
      return next;
    } catch (e) {
      const retryable = e instanceof StoragePreconditionError || (e instanceof Error && e.name === "StorageAlreadyExistsError");
      if (!retryable || attempt === retries) {
        if (retryable) throw new ConflictError();
        throw e;
      }
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1) + Math.random() * 60));
    }
  }
  throw new ConflictError();
}
