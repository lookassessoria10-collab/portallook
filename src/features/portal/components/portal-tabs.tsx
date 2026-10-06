import Link from "next/link";
import { BarChart3, CalendarRange, MousePointerClick } from "lucide-react";
import type { PortalTab } from "@/features/portal/model";
import { REPORT_TYPE_LABEL, REPORT_TYPE_PATH } from "@/features/reports/schema";
import { cn } from "@/lib/cn";

const TAB_ICON: Record<PortalTab, typeof BarChart3> = {
  commercial: BarChart3,
  traffic: MousePointerClick,
  media_plan: CalendarRange,
};

/** Controle segmentado entre áreas — só aparece se o cliente tiver mais de uma. */
export function PortalTabs({ tabs, active, basePath, className }: { tabs: PortalTab[]; active: PortalTab; basePath: string; className?: string }) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Áreas do relatório" className={cn("grid gap-1 rounded-[14px] border border-border bg-surface p-1", tabs.length > 2 ? "grid-cols-3" : "grid-cols-2", className)}>
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
              "flex h-10 min-w-0 items-center justify-center gap-2 rounded-[10px] px-2 text-sm font-bold transition-colors",
              isActive ? "bg-primary text-on-primary shadow-[0_6px_18px_-8px_rgb(0_174_239/0.8)]" : "text-text-2 hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {/* No celular, com três áreas, o plano de mídia vira só "Plano". */}
            <span className="truncate">
              {tab === "media_plan" && tabs.length > 2 ? (
                <>
                  <span className="sm:hidden">Plano</span>
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
