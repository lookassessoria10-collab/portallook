import { CalendarX2, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { PERIOD_NOTE_STATUS_LABEL } from "@/features/period-notes/schema";
import type { PortalNotice } from "@/features/portal/model";

const STATUS_STYLE = {
  no_data: { box: "border-[rgb(246_189_91/0.28)] bg-attention-soft", icon: "text-attention" },
  partial: { box: "border-[rgb(140_156_248/0.28)] bg-info-soft", icon: "text-info" },
} as const;

/** Justificativas no topo da área: "Outubro de 2026 · Dados incompletos" + o texto da Look. */
export function PeriodNotices({ notices, className }: { notices: PortalNotice[]; className?: string }) {
  if (!notices.length) return null;
  return (
    <ul className={cn("space-y-2.5", className)} aria-label="Observações da Look sobre os meses">
      {notices.map((n) => {
        const style = STATUS_STYLE[n.status];
        const Icon = n.status === "no_data" ? CalendarX2 : Info;
        return (
          <li key={n.key} className={cn("flex items-start gap-3 rounded-[var(--radius-lg)] border px-4 py-3", style.box)}>
            <Icon className={cn("mt-0.5 size-5 shrink-0", style.icon)} aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-bold text-text">
                {n.label} <span className={cn("font-semibold", style.icon)}>· {PERIOD_NOTE_STATUS_LABEL[n.status]}</span>
              </p>
              <p className="mt-0.5 leading-relaxed text-text-2">{n.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Mês aberto sem relatório: o mês e a justificativa no lugar dos números. */
export function MissingPeriod({ notice }: { notice: PortalNotice }) {
  const style = STATUS_STYLE[notice.status];
  const Icon = notice.status === "no_data" ? CalendarX2 : Info;
  return (
    <section className="card mx-auto max-w-2xl px-6 py-10 text-center sm:px-10 sm:py-14" aria-labelledby="mes-sem-dados">
      <div className={cn("mx-auto grid size-14 place-items-center rounded-2xl border", style.box)} aria-hidden>
        <Icon className={cn("size-6", style.icon)} />
      </div>
      <p className={cn("mt-5 text-[11px] font-bold uppercase tracking-[0.16em]", style.icon)}>{PERIOD_NOTE_STATUS_LABEL[notice.status]}</p>
      <h2 id="mes-sem-dados" className="mt-1.5 text-xl font-bold text-text sm:text-2xl">
        {notice.label}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-text-2">{notice.text}</p>
      <p className="mt-6 text-xs text-text-3">Justificativa da equipe Look</p>
    </section>
  );
}
