import "server-only";
import { env } from "@/lib/env";
import { verifyPassword } from "./password";

export interface AdminIdentity {
  email: string;
}

/**
 * Contrato de autenticação do ADM. Hoje: credencial única via variáveis de
 * ambiente. Para migrar para Auth.js, Clerk ou Supabase Auth, basta outra
 * implementação desta interface (e ajustar session.ts).
 */
export interface AdminAuthProvider {
  readonly configured: boolean;
  authenticate(email: string, password: string): Promise<AdminIdentity | null>;
}

class EnvAdminAuthProvider implements AdminAuthProvider {
  get configured() {
    const e = env();
    return Boolean(e.ADMIN_EMAIL && e.ADMIN_PASSWORD_HASH && e.SESSION_SECRET && e.SESSION_SECRET.length >= 32);
  }

  async authenticate(email: string, password: string) {
    const { ADMIN_EMAIL, ADMIN_PASSWORD_HASH } = env();
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) return null;
    const emailOk = email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
    // Verifica a senha mesmo com e-mail errado para não revelar e-mails válidos pelo tempo.
    const passwordOk = await verifyPassword(password, ADMIN_PASSWORD_HASH);
    return emailOk && passwordOk ? { email: ADMIN_EMAIL.trim().toLowerCase() } : null;
  }
}

let provider: AdminAuthProvider | null = null;
export function getAuthProvider(): AdminAuthProvider {
  provider ??= new EnvAdminAuthProvider();
  return provider;
}
