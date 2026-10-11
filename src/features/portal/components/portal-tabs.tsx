import Link from "next/link";
import { BarChart3, CalendarRange, MessageCircleHeart, MousePointerClick } from "lucide-react";
import type { PortalTab } from "@/features/portal/model";
import { REPORT_TYPE_LABEL, REPORT_TYPE_PATH } from "@/features/reports/schema";
import { cn } from "@/lib/cn";

const TAB_ICON: Record<PortalTab, typeof BarChart3> = {
  commercial: BarChart3,
  traffic: MousePointerClick,
  social: MessageCircleHeart,
  media_plan: CalendarRange,
};

/** Rótulo curto no celular quando há três áreas ou mais. */
const SHORT_LABEL: Partial<Record<PortalTab, string>> = { social: "Social", media_plan: "Plano" };

const GRID_COLS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

/** Controle segmentado entre áreas — só aparece se o cliente tiver mais de uma. */
export function PortalTabs({ tabs, active, basePath, className }: { tabs: PortalTab[]; active: PortalTab; basePath: string; className?: string }) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Áreas do relatório" className={cn("grid gap-1 rounded-[14px] border border-border bg-surface p-1", GRID_COLS[tabs.length] ?? "grid-cols-4", className)}>
      {tabs.map((tab) => {
        const Icon = TAB_ICON[tab];
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={`${basePath}?aba=${REPORT_TYPE_PATH[tab]}`}
            aria-current={isActive ? "page" : undefined}
            scroll={false}
            className={cn(
              "flex h-10 min-w-0 items-center justify-center rounded-[10px] text-sm font-bold transition-colors",
              // Celular com três áreas ou mais: abas compactas (com quatro, sem ícone) para os nomes caberem.
              tabs.length > 2 ? "gap-1.5 px-1 max-sm:text-[13px] sm:gap-2 sm:px-2" : "gap-2 px-2",
              isActive ? "bg-primary text-on-primary shadow-[0_6px_18px_-8px_rgb(0_174_239/0.8)]" : "text-text-2 hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className={cn("size-4 shrink-0", tabs.length > 3 && "max-sm:hidden")} aria-hidden />
            {/* No celular, com três áreas ou mais, "Plano de mídia" vira "Plano" e "Rede social" vira "Social". */}
            <span className="truncate">
              {SHORT_LABEL[tab] && tabs.length > 2 ? (
                <>
                  <span className="sm:hidden">{SHORT_LABEL[tab]}</span>
                  <span className="hidden sm:inline">{TAB_LABEL[tab]}</span>
                </>
              ) : (
                TAB_LABEL[tab]
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export const TAB_LABEL: Record<PortalTab, string> = REPORT_TYPE_LABEL;
