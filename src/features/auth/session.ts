import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env, isProduction, requireSecret } from "@/lib/env";
import { SESSION_COOKIE, signSession, verifySession, type AdminSession } from "./session-token";

export async function createSession(email: string) {
  const { token, expiresAt } = await signSession(email, requireSecret("SESSION_SECRET"), env().SESSION_TTL_HOURS);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, env().SESSION_SECRET);
});

/**
 * Proteção em profundidade: o proxy já barra rotas /adm, mas toda página e
 * ação administrativa confirma a sessão novamente no servidor.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect("/adm/login");
  return session;
}
