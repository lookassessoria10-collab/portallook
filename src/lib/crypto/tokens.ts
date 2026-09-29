import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { requireSecret } from "@/lib/env";

/** Token de acesso do cliente: 32 bytes aleatórios (CSPRNG) em base64url = 43 caracteres. */
export const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

function derivedKey(purpose: "token-hmac" | "token-encryption"): Buffer {
  const secret = requireSecret("PORTAL_TOKEN_SECRET");
  return Buffer.from(hkdfSync("sha256", secret, "portal-look", purpose, 32));
}

export function hashAccessToken(token: string): string {
  return createHmac("sha256", derivedKey("token-hmac")).update(token).digest("hex");
}

/** Comparação em tempo constante — não revela, por tempo de resposta, quanto do token está certo. */
export function verifyAccessToken(token: string, expectedHash: string): boolean {
  if (!ACCESS_TOKEN_PATTERN.test(token) || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(hashAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey("token-encryption"), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptToken(payload: string): string | null {
  try {
    const [version, iv, tag, data] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", derivedKey("token-encryption"), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Identificação curta para interface e logs — nunca o token completo. */
export function tokenHint(token: string): string {
  return token.slice(-4);
}
