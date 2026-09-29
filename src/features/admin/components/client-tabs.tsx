"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function ClientTabs({ clientId, modules }: { clientId: string; modules: { commercial: boolean; traffic: boolean } }) {
  const pathname = usePathname();
  const base = `/adm/clientes/${clientId}`;
  const tabs = [
    { href: base, label: "Visão geral", exact: true },
    ...(modules.commercial ? [{ href: `${base}/comercial`, label: "Comercial" }] : []),
    ...(modules.traffic ? [{ href: `${base}/trafego`, label: "Tráfego" }] : []),
    { href: `${base}/arquivos`, label: "Arquivos" },
    { href: `${base}/configuracoes`, label: "Configurações" },
    { href: `${base}/acesso`, label: "Acesso" },
  ];
  return (
    <nav aria-label="Seções do cliente" className="scrollbar-none -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center px-3 text-sm font-semibold transition-colors",
                  active ? "text-text after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary" : "text-text-3 hover:text-text",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
