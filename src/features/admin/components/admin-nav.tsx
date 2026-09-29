"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, UploadCloud, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/adm", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/adm/clientes", label: "Clientes", icon: Users },
  { href: "/adm/pendencias", label: "Pendências", icon: ClipboardList, badgeKey: "pending" as const },
  { href: "/adm/uploads", label: "Uploads", icon: UploadCloud },
];

export function AdminNav({ pendingCount, onNavigate }: { pendingCount: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação do painel">
      <ul className="space-y-1">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold transition-colors",
                  active ? "bg-primary-soft text-text shadow-[inset_2px_0_0_var(--primary)]" : "text-text-2 hover:bg-surface-2 hover:text-text",
                )}
              >
                <Icon className={cn("size-[18px]", active ? "text-primary" : "text-text-3")} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badgeKey && pendingCount > 0 ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-attention-soft px-1.5 text-[11px] font-bold text-attention" aria-label={`${pendingCount} pendências`}>
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
