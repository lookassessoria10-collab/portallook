import Link from "next/link";
import { BarChart3, MousePointerClick } from "lucide-react";
import type { PortalTab } from "@/features/portal/model";
import { cn } from "@/lib/cn";

const TAB_META: Record<PortalTab, { label: string; param: string; icon: typeof BarChart3 }> = {
  commercial: { label: "Comercial", param: "comercial", icon: BarChart3 },
  traffic: { label: "Tráfego", param: "trafego", icon: MousePointerClick },
};

/** Controle segmentado entre áreas — só aparece se o cliente tiver mais de uma. */
export function PortalTabs({ tabs, active, basePath, className }: { tabs: PortalTab[]; active: PortalTab; basePath: string; className?: string }) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Áreas do relatório" className={cn("grid grid-cols-2 gap-1 rounded-[14px] border border-border bg-surface p-1", className)}>
      {tabs.map((tab) => {
        const meta = TAB_META[tab];
        const Icon = meta.icon;
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={`${basePath}?aba=${meta.param}`}
            aria-current={isActive ? "page" : undefined}
            scroll={false}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-[10px] text-sm font-bold transition-colors",
              isActive ? "bg-primary text-on-primary shadow-[0_6px_18px_-8px_rgb(0_174_239/0.8)]" : "text-text-2 hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {meta.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const TAB_LABEL: Record<PortalTab, string> = { commercial: "Comercial", traffic: "Tráfego" };
