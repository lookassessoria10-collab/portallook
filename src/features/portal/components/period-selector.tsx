"use client";

import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { PortalPeriodOption } from "@/features/portal/model";
import { cn } from "@/lib/cn";

/** Seletor de período nativo (ótimo no celular: abre o seletor do sistema). */
export function PeriodSelector({ periods, value, className }: { periods: PortalPeriodOption[]; value: string | null; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (!periods.length) return null;
  return (
    <label className={cn("relative flex h-11 min-w-0 items-center gap-2 rounded-[12px] border border-border-strong bg-surface px-3 hover:border-[rgb(148_176_214/0.3)]", pending && "opacity-70", className)}>
      <CalendarDays className="size-4 shrink-0 text-text-3" aria-hidden />
      <span className="sr-only">Período</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("periodo", e.target.value);
          startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
        className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-[15px] font-semibold text-text focus:outline-none"
      >
        {periods.map((p) => (
          <option key={p.key} value={p.key} className="bg-surface text-text">
            {p.label}
          </option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-3 size-4 text-text-3" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
