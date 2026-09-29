import { jwtVerify, SignJWT } from "jose";

/**
 * Sessão administrativa assinada (JWT HS256) guardada em cookie HttpOnly.
 * Este módulo não depende de next/headers para poder ser usado no proxy.
 */
export const SESSION_COOKIE = "portal_look_adm";
const ISSUER = "portal-look";
const AUDIENCE = "portal-look-admin";

export interface AdminSession {
  email: string;
  expiresAt: number;
}

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(email: string, secret: string, ttlHours: number): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key(secret));
  return { token, expiresAt };
}

export async function verifySession(token: string | undefined, secret: string | undefined): Promise<AdminSession | null> {
  if (!token || !secret || secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    if (payload.role !== "admin" || typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    return { email: payload.sub, expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
}
