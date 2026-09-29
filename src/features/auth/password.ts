import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))));
}

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 128 * N * R * 2;

/**
 * Formato: `scrypt:N:r:p:salt:hash` (base64url). Sem "$" de propósito: o
 * carregador de .env do Next expande "$VAR" e corromperia o hash.
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) throw new Error("A senha precisa ter pelo menos 10 caracteres.");
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join(":");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64url");
  if (expected.length !== KEYLEN) return false;
  try {
    const key = await scrypt(password, Buffer.from(saltB64, "base64url"), KEYLEN, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * Number(n) * Number(r) * 2,
    });
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
