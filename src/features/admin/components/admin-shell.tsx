import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, UploadCloud } from "lucide-react";
import { LookLogo } from "@/components/brand/look-logo";
import { buttonClass } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions";
import { AdminNav } from "./admin-nav";
import { AdminMobileMenu } from "./admin-mobile-menu";

/** Estrutura do ADM: sidebar estreita no desktop, gaveta no celular. */
export function AdminShell({ children, email, pendingCount }: { children: ReactNode; email: string; pendingCount: number }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <a href="#adm-main" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Pular para o conteúdo
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-bg-elevated/60 px-4 py-6 lg:flex">
        <Link href="/adm" className="mb-8 block px-2" aria-label="Portal Look — visão geral">
          <LookLogo width={104} priority />
          <span className="mt-2 block text-xs font-semibold text-text-3">Painel de relatórios</span>
        </Link>
        <AdminNav pendingCount={pendingCount} />
        <div className="mt-auto space-y-3 px-2">
          <div className="brand-rule w-10 opacity-80" aria-hidden />
          <p className="truncate text-xs text-text-3" title={email}>
            {email}
          </p>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex items-center gap-2 text-xs font-semibold text-text-2 hover:text-text">
              <LogOut className="size-3.5" aria-hidden /> Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center gap-2 border-b border-border bg-[rgb(6_14_28/0.94)] px-3 sm:px-6 lg:px-8">
          <AdminMobileMenu pendingCount={pendingCount} email={email} />
          <Link href="/adm" className="lg:hidden" aria-label="Início do painel">
            <LookLogo wordmark width={64} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/adm/uploads" className={buttonClass("primary", "sm")}>
              <UploadCloud className="size-4" aria-hidden />
              <span>Novo upload</span>
            </Link>
            <form action={logoutAction} className="lg:hidden">
              <button type="submit" className={buttonClass("ghost", "icon")} aria-label="Sair">
                <LogOut className="size-[18px]" aria-hidden />
              </button>
            </form>
          </div>
        </header>
        <main id="adm-main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-text-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
