"use client";

import Link, { useLinkStatus } from "next/link";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PeriodNavItem {
  key: string;
  label: string;
  title: string;
  href: string;
  draft?: boolean;
}

/** Rótulo que esmaece enquanto a navegação do link está pendente (sem deslocar o layout). */
function PendingLabel({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={cn("inline-flex items-center gap-1.5 transition-opacity", pending && "animate-pulse opacity-60")}>{children}</span>;
}

/**
 * Abas de período: "Visão geral" seguida dos períodos em ordem cronológica.
 * Rola na horizontal no celular, mantendo a aba ativa à vista.
 */
export function PeriodNav({ overviewHref, items, active, className }: { overviewHref: string | null; items: PeriodNavItem[]; active: string | null; className?: string }) {
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current) return;
    const offset = current.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
    list.scrollTo({ left: Math.max(0, offset - (list.clientWidth - current.offsetWidth) / 2) });
  }, [active]);

  if (!items.length) return null;
  const pill = (isActive: boolean) =>
    cn(
      "flex h-9 shrink-0 items-center rounded-[10px] px-3.5 text-sm font-bold transition-colors",
      isActive ? "bg-primary-soft text-primary ring-1 ring-inset ring-[rgb(0_174_239/0.35)]" : "text-text-2 hover:bg-surface-2 hover:text-text",
    );

  return (
    <nav aria-label="Período" className={cn("min-w-0 rounded-[14px] border border-border bg-surface p-1", className)}>
      <div ref={listRef} className="scrollbar-none flex gap-1 overflow-x-auto">
        {overviewHref ? (
          <Link href={overviewHref} scroll={false} aria-current={active === null ? "page" : undefined} className={pill(active === null)}>
            <PendingLabel>
              <LayoutGrid className="size-4" aria-hidden />
              Visão geral
            </PendingLabel>
          </Link>
        ) : null}
        {overviewHref ? <span className="mx-0.5 my-2 w-px shrink-0 bg-border-strong" aria-hidden /> : null}
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <Link key={item.key} href={item.href} scroll={false} title={item.draft ? `${item.title} (rascunho)` : item.title} aria-current={isActive ? "page" : undefined} className={pill(isActive)}>
              <PendingLabel>
                {item.label}
                {item.draft ? (
                  <>
                    <span className="size-1.5 rounded-full bg-attention" aria-hidden />
                    <span className="sr-only">(rascunho)</span>
                  </>
                ) : null}
              </PendingLabel>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** "Meses | Semanas": só aparece quando a área tem relatórios nas duas escalas. */
export function ScaleSwitch({ options, className }: { options: Array<{ key: string; label: string; href: string; active: boolean }>; className?: string }) {
  if (options.length < 2) return null;
  return (
    <nav aria-label="Escala dos períodos" className={cn("grid shrink-0 grid-cols-2 gap-1 rounded-[14px] border border-border bg-surface p-1", className)}>
      {options.map((o) => (
        <Link
          key={o.key}
          href={o.href}
          scroll={false}
          aria-current={o.active ? "page" : undefined}
          className={cn("flex h-9 items-center justify-center rounded-[10px] px-3 text-sm font-bold transition-colors", o.active ? "bg-surface-3 text-text" : "text-text-3 hover:bg-surface-2 hover:text-text-2")}
        >
          <PendingLabel>{o.label}</PendingLabel>
        </Link>
      ))}
    </nav>
  );
}
