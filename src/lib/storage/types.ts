export interface StoredObject {
  body: Buffer;
  contentType: string;
  etag: string;
  size: number;
}

export interface StoredStream {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
  etag: string;
}

export interface StoredListing {
  path: string;
  size: number;
  uploadedAt: Date;
}

export interface PutOptions {
  contentType: string;
  /** Só grava se o ETag atual for este (controle de concorrência otimista). */
  ifMatch?: string;
  /** Falha se o caminho já existir (reserva atômica, ex.: slug). */
  ifNotExists?: boolean;
}

/**
 * Abstração de armazenamento. Toda a aplicação fala com esta interface;
 * trocar Blob por S3/R2/disco não exige mexer em repositórios ou UI.
 */
export interface StorageProvider {
  readonly driver: "local" | "vercel-blob";
  /** Upload direto navegador → storage (sem passar arquivo pela função). */
  readonly supportsDirectUpload: boolean;
  get(path: string): Promise<StoredObject | null>;
  getStream(path: string): Promise<StoredStream | null>;
  put(path: string, body: Buffer | Uint8Array | string, options: PutOptions): Promise<{ etag: string }>;
  delete(paths: string | string[]): Promise<void>;
  list(prefix: string): Promise<StoredListing[]>;
  /** Subpastas imediatas de `prefix` (terminado em "/"). */
  listFolders(prefix: string): Promise<string[]>;
  copy(from: string, to: string, contentType: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Remove tudo sob `prefix` (terminado em "/"). Retorna quantos arquivos saíram. */
  deletePrefix(prefix: string): Promise<number>;
}

/** Prefixos de exclusão em massa precisam ser pastas seguras e específicas (nunca a raiz). */
export function assertSafePrefix(prefix: string): string {
  if (!prefix.endsWith("/") || prefix.split("/").filter(Boolean).length < 2) {
    throw new Error(`Prefixo de exclusão inválido: ${JSON.stringify(prefix)}`);
  }
  assertSafePath(prefix.slice(0, -1));
  return prefix;
}

export class StoragePreconditionError extends Error {
  constructor(public readonly path: string) {
    super(`Precondition failed for ${path}`);
    this.name = "StoragePreconditionError";
  }
}

export class StorageAlreadyExistsError extends Error {
  constructor(public readonly path: string) {
    super(`Already exists: ${path}`);
    this.name = "StorageAlreadyExistsError";
  }
}

const CONTENT_TYPES: Record<string, string> = {
  json: "application/json",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function contentTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Valida caminhos internos: sem `..`, sem barra inicial, sem caracteres de
 * controle. Os caminhos são sempre montados pelo sistema a partir de IDs
 * validados (ver paths.ts); esta checagem é a última linha de defesa.
 */
export function assertSafePath(path: string): string {
  if (
    !path ||
    path.length > 400 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").some((seg) => seg === ".." || seg === "." || seg === "") ||
    !/^[A-Za-z0-9._\-/]+$/.test(path)
  ) {
    throw new Error(`Caminho de armazenamento inválido: ${JSON.stringify(path)}`);
  }
  return path;
}
