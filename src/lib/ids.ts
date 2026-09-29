const ALPHABET = "0123456789abcdefghijkmnpqrstuvwxyz";

/** Identificador interno aleatório e não sequencial (ex.: `cl_8f3k2m9qa1`). */
export function createId(prefix: "cl" | "rp" | "im" | "ev" | "in", length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export const ID_PATTERN = /^(cl|rp|im|ev|in)_[0-9a-z]{6,32}$/;

export function isValidId(value: unknown, prefix?: string): value is string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) return false;
  return prefix ? value.startsWith(`${prefix}_`) : true;
}

/** Converte um texto em slug seguro para URL (sem acentos, minúsculo, hífens). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normaliza texto para comparação (sem acento, minúsculo, espaços simples). */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}
