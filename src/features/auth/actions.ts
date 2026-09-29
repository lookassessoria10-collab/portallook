"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logError } from "@/lib/errors";
import { logEvent } from "@/features/events/service";
import { getAuthProvider } from "./provider";
import { clearFailures, isRateLimited, registerFailure } from "./rate-limit";
import { createSession, destroySession } from "./session";

export interface LoginState {
  error?: string;
  email?: string;
}

const LoginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(200),
  password: z.string().min(1, "Informe a senha.").max(200),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = (form.get("email") ?? "").toString().slice(0, 200);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", email };

  const provider = getAuthProvider();
  if (!provider.configured) {
    return { error: "O acesso administrativo ainda não foi configurado. Defina ADMIN_EMAIL, ADMIN_PASSWORD_HASH e SESSION_SECRET.", email };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const key = `${ip}:${parsed.data.email.toLowerCase()}`;
  if (isRateLimited(key)) return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.", email };

  let ok = false;
  try {
    const identity = await provider.authenticate(parsed.data.email, parsed.data.password);
    if (identity) {
      await createSession(identity.email);
      clearFailures(key);
      await logEvent("auth.login", { actor: identity.email, summary: "Login no painel administrativo." });
      ok = true;
    }
  } catch (e) {
    logError("login", e);
    return { error: "Não foi possível entrar agora. Tente novamente em instantes.", email };
  }

  if (!ok) {
    registerFailure(key);
    await sleep(350 + Math.random() * 250);
    await logEvent("auth.login_failed", { summary: "Tentativa de login recusada." });
    return { error: "E-mail ou senha incorretos.", email };
  }

  const next = (form.get("next") ?? "").toString();
  redirect(next.startsWith("/adm") && !next.startsWith("//") ? next : "/adm");
}

export async function logoutAction() {
  await destroySession();
  redirect("/adm/login");
}
