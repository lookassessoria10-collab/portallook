import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LookLogo } from "@/components/brand/look-logo";
import { getSession } from "@/features/auth/session";
import { getAuthProvider } from "@/features/auth/provider";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/adm/login">) {
  if (await getSession()) redirect("/adm");
  const search = await props.searchParams;
  const next = typeof search.next === "string" ? search.next : "";
  const configured = getAuthProvider().configured;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LookLogo width={132} priority />
          <p className="text-sm font-semibold text-text-3">Portal de relatórios · Acesso da equipe</p>
        </div>
        <div className="card p-6 sm:p-7">
          <h1 className="text-xl font-bold text-text">Entrar no painel</h1>
          <p className="mt-1 text-sm text-text-3">Use o e-mail e a senha configurados para a equipe Look.</p>
          {!configured ? (
            <p className="mt-4 rounded-xl border border-[rgb(246_189_91/0.25)] bg-attention-soft p-3 text-[13px] leading-relaxed text-attention" role="status">
              O login ainda não foi configurado neste ambiente. Defina ADMIN_EMAIL, ADMIN_PASSWORD_HASH e SESSION_SECRET (em desenvolvimento: <code className="font-mono">npm run setup</code>).
            </p>
          ) : null}
          <LoginForm next={next} />
        </div>
        <div className="brand-rule mx-auto mt-8 w-12 opacity-70" aria-hidden />
      </div>
    </main>
  );
}
