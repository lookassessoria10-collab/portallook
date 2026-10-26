"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, CalendarRange, ListChecks, MessageCircleHeart, MousePointerClick } from "lucide-react";
import type { PortalArea } from "@/features/portal/model";
import { AREA_LABEL } from "@/features/portal/labels";
import { ACTIONS_TAB_PARAM, CONTENT_TAB_PARAM } from "@/features/portal/params";
import { REPORT_TYPE_PATH } from "@/features/reports/schema";
import { cn } from "@/lib/cn";

const TAB_ICON: Record<PortalArea, typeof BarChart3> = {
  commercial: BarChart3,
  traffic: MousePointerClick,
  social: MessageCircleHeart,
  media_plan: CalendarRange,
  content: CalendarDays,
  actions: ListChecks,
};

const TAB_PARAM: Record<PortalArea, string> = { ...REPORT_TYPE_PATH, content: CONTENT_TAB_PARAM, actions: ACTIONS_TAB_PARAM };

/** Rótulo curto no celular quando há três áreas ou mais. */
const SHORT_LABEL: Partial<Record<PortalArea, string>> = { social: "Social", media_plan: "Plano" };

const GRID_COLS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };

/**
 * Controle segmentado entre áreas — só aparece se o cliente tiver mais de uma.
 * Com seis áreas, no celular vira uma faixa que rola para o lado (a área aberta fica à vista).
 */
export function PortalTabs({ tabs, active, basePath, className }: { tabs: PortalArea[]; active: PortalArea; basePath: string; className?: string }) {
  const navRef = useRef<HTMLElement>(null);
  const scrolls = tabs.length > 5;

  useLayoutEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || !scrolls || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: Math.max(0, current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2) });
  }, [active, scrolls]);

  if (tabs.length < 2) return null;
  return (
    <nav
      ref={navRef}
      aria-label="Áreas do relatório"
      className={cn(
        "relative gap-1 rounded-[14px] border border-border bg-surface p-1",
        scrolls ? "scrollbar-none flex overflow-x-auto sm:grid sm:grid-cols-6 sm:overflow-visible" : cn("grid", GRID_COLS[tabs.length] ?? "grid-cols-4"),
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICON[tab];
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={`${basePath}?aba=${TAB_PARAM[tab]}`}
            aria-current={isActive ? "page" : undefined}
            scroll={false}
            className={cn(
              "flex h-10 min-w-0 items-center justify-center rounded-[10px] text-sm font-bold transition-colors",
              // Celular com três áreas ou mais: abas compactas (com quatro, sem ícone) para os nomes caberem.
              scrolls
                ? "shrink-0 gap-1.5 px-3 max-sm:text-[13px] sm:gap-2 sm:px-2"
                : tabs.length > 4
                  ? "gap-1.5 px-0.5 max-sm:text-[11px] sm:gap-2 sm:px-2"
                  : tabs.length > 2
                    ? "gap-1.5 px-1 max-sm:text-[13px] sm:gap-2 sm:px-2"
                    : "gap-2 px-2",
              isActive ? "bg-primary text-on-primary shadow-[0_6px_18px_-8px_rgb(0_174_239/0.8)]" : "text-text-2 hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className={cn("size-4 shrink-0", tabs.length > 3 && "max-sm:hidden")} aria-hidden />
            {/* No celular, com três áreas ou mais, "Plano de mídia" vira "Plano" e "Rede social" vira "Social". */}
            <span className="truncate">
              {SHORT_LABEL[tab] && tabs.length > 2 ? (
                <>
                  <span className="sm:hidden">{SHORT_LABEL[tab]}</span>
                  <span className="hidden sm:inline">{AREA_LABEL[tab]}</span>
                </>
              ) : (
                AREA_LABEL[tab]
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

