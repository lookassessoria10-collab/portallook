"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SECTION_PARAM } from "@/features/portal/params";

export interface SectionTab {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * Abas do painel (Visão geral, Canais & ROI, detalhamentos, Insights). Todas as abas
 * já vêm renderizadas do servidor; trocar de aba só alterna a visível e atualiza a URL
 * sem recarregar, para o mês escolhido em seguida abrir na mesma aba.
 */
export function SectionTabs({ tabs, initial, idPrefix = "secao", bleed = true }: { tabs: SectionTab[]; initial?: string | null; idPrefix?: string; bleed?: boolean }) {
  const [chosen, setActive] = useState(() => initial);
  // Aba que não existe neste mês (ex.: detalhamento sem dados) volta para a primeira.
  const active = chosen && tabs.some((t) => t.key === chosen) ? chosen : tabs[0]?.key;
  const listRef = useRef<HTMLDivElement>(null);

  const select = (key: string, focus = false) => {
    setActive(key);
    const url = new URL(window.location.href);
    if (key === tabs[0]?.key) url.searchParams.delete(SECTION_PARAM);
    else url.searchParams.set(SECTION_PARAM, key);
    window.history.replaceState(null, "", url);
    if (focus) listRef.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length].key, true);
  };

  if (tabs.length < 2) return <div>{tabs[0]?.content}</div>;
  return (
    <div>
      {/* Na página do portal, a barra vai de ponta a ponta (sangra o padding do contêiner). */}
      <div className={cn("sticky top-0 z-20 border-b border-border bg-[rgb(9_21_42/0.96)] shadow-[0_8px_20px_-16px_rgb(0_0_0/0.9)] backdrop-blur", bleed ? "-mx-4 px-2 sm:-mx-6 sm:px-4 lg:-mx-8 lg:px-6" : "rounded-t-xl")}>
        <div ref={listRef} role="tablist" aria-label="Seções do painel" onKeyDown={onKeyDown} className="scrollbar-none flex overflow-x-auto">
          {tabs.map((t) => {
            const selected = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`${idPrefix}-tab-${t.key}`}
                data-key={t.key}
                aria-selected={selected}
                aria-controls={`${idPrefix}-${t.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(t.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap border-b-2 px-3.5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors sm:px-5 sm:py-4 sm:text-xs",
                  selected ? "border-primary text-primary" : "border-transparent text-text-3 hover:text-text-2",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`${idPrefix}-${t.key}`} aria-labelledby={`${idPrefix}-tab-${t.key}`} hidden={t.key !== active} className="pt-7 sm:pt-8">
          {t.content}
        </div>
      ))}
    </div>
  );
}
