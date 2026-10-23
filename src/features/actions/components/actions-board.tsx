"use client";

import { useState, type ReactNode } from "react";
import { CircleCheck, Lightbulb, ListChecks, LoaderCircle, Rocket } from "lucide-react";
import { formatDate } from "@/lib/dates/period";
import { formatInteger } from "@/lib/format/number";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { ACTION_KIND_LABEL, ACTION_STATUS_CLIENT_LABEL, ACTION_STATUS_TONE, type ActionStatus } from "@/features/actions/schema";
import type { PortalActionItem, PortalActionsVM } from "@/features/actions/view-model";

/**
 * Área "Ações" do portal: o que a Look está fazendo, o que já foi feito e as próximas ideias.
 * Recebe só os campos públicos de cada ação (nunca as observações internas).
 */
export function ActionsBoard({ vm }: { vm: PortalActionsVM }) {
  const [filter, setFilter] = useState<ActionStatus | "all">("all");
  const { summary } = vm;
  const groups = filter === "all" ? vm.groups : vm.groups.filter((g) => g.status === filter);
  const kinds = summary.oneOff + summary.continuous;
  const topCategory = summary.categories[0]?.count ?? 0;

  return (
    <div className="space-y-8 sm:space-y-10">
      <section aria-label="Resumo das ações" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Kpi label="Ações no plano" value={summary.total} icon={<ListChecks />} className="col-span-2 lg:col-span-1" highlight />
        <Kpi label="Em andamento" value={summary.byStatus.in_progress + summary.byStatus.pending} icon={<LoaderCircle />} />
        <Kpi label="Executadas" value={summary.executed} icon={<Rocket />} hint="Com data de execução" />
        <Kpi label="Concluídas" value={summary.byStatus.done} icon={<CircleCheck />} />
        <Kpi label="Sugeridas" value={summary.byStatus.suggested} icon={<Lightbulb />} hint="Ideias aguardando decisão" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="acoes-lista-title" className="min-w-0">
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <h2 id="acoes-lista-title" className="text-[17px] font-bold text-text sm:text-lg">
                Ações da Look
              </h2>
              <p className="mt-0.5 text-[13px] leading-snug text-text-3">Iniciativas sugeridas e executadas pela equipe para fortalecer a sua marca.</p>
            </div>
            <div role="group" aria-label="Filtrar por situação" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Todas" count={summary.total} />
              {vm.groups.map((g) => (
                <FilterChip key={g.status} active={filter === g.status} onClick={() => setFilter(g.status)} label={CHIP_LABEL[g.status]} count={g.items.length} />
              ))}
            </div>
          </div>

          <div className="space-y-7">
            {groups.map((g) => (
              <section key={g.status} aria-label={`${g.label}: ${g.items.length}`}>
                <h3 className="dash-label mb-3">
                  {plural(g.status, g.items.length)} · {g.items.length}
                </h3>
                <ul className="grid gap-3 md:grid-cols-2">
                  {g.items.map((a) => (
                    <ActionCard key={a.id} action={a} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Distribuição das ações">
          {summary.categories.length ? (
            <section className="card p-4 sm:p-5" aria-labelledby="acoes-frentes-title">
              <h2 id="acoes-frentes-title" className="text-[15px] font-bold text-text">
                Frentes de trabalho
              </h2>
              <p className="mt-0.5 text-[13px] text-text-3">Quantas ações há em cada frente.</p>
              <ul className="mt-4 space-y-3">
                {summary.categories.map((c) => (
                  <li key={c.label}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate font-semibold text-text-2">{c.label}</span>
                      <span className="tabular shrink-0 font-bold text-text">{c.count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--chart-track)]" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (c.count / topCategory) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {kinds ? (
            <section className="card p-4 sm:p-5" aria-labelledby="acoes-tipo-title">
              <h2 id="acoes-tipo-title" className="text-[15px] font-bold text-text">
                Pontuais × contínuas
              </h2>
              <p className="mt-0.5 text-[13px] text-text-3">Ações com entrega única e ações recorrentes.</p>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--chart-track)]" aria-hidden>
                <div className="h-full bg-primary" style={{ width: `${(summary.oneOff / kinds) * 100}%` }} />
                <div className="h-full bg-[var(--brand-green)]" style={{ width: `${(summary.continuous / kinds) * 100}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="flex items-center gap-1.5 text-text-3">
                    <span className="size-2 rounded-full bg-primary" aria-hidden /> Pontuais
                  </dt>
                  <dd className="tabular mt-0.5 text-lg font-bold text-text">{summary.oneOff}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-text-3">
                    <span className="size-2 rounded-full bg-[var(--brand-green)]" aria-hidden /> Contínuas
                  </dt>
                  <dd className="tabular mt-0.5 text-lg font-bold text-text">{summary.continuous}</dd>
                </div>
              </dl>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

const GROUP_TITLE: Record<ActionStatus, [string, string]> = {
  in_progress: ["Em andamento", "Em andamento"],
  pending: ["Pendente", "Pendentes"],
  done: ["Concluída", "Concluídas"],
  approved: ["Aprovada", "Aprovadas"],
  suggested: ["Sugestão da Look", "Sugestões da Look"],
  rejected: ["Não aprovada", "Não aprovadas"],
};

const plural = (status: ActionStatus, n: number) => GROUP_TITLE[status][n === 1 ? 0 : 1];

const CHIP_LABEL: Record<ActionStatus, string> = {
  in_progress: "Em andamento",
  pending: "Pendentes",
  done: "Concluídas",
  approved: "Aprovadas",
  suggested: "Sugeridas",
  rejected: "Não aprovadas",
};

function Kpi({ label, value, icon, hint, highlight, className }: { label: string; value: number; icon: ReactNode; hint?: string; highlight?: boolean; className?: string }) {
  return (
    <article className={cn("card flex min-w-0 flex-col gap-2 p-4 sm:p-5", highlight && "border-[rgb(0_174_239/0.3)] bg-[linear-gradient(135deg,rgb(0_174_239/0.12),transparent_70%)]", className)}>
      <header className="flex items-center gap-2">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg [&>svg]:size-4", highlight ? "bg-primary-soft text-primary" : "bg-surface-2 text-text-2")} aria-hidden>
          {icon}
        </span>
        <h3 className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-text-2">{label}</h3>
      </header>
      <p className="tabular text-[1.75rem] font-bold leading-none tracking-tight text-text">{formatInteger(value)}</p>
      {hint ? <p className="text-xs text-text-3">{hint}</p> : null}
    </article>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
        active ? "border-transparent bg-primary text-on-primary" : "border-border-strong text-text-2 hover:bg-surface-2 hover:text-text",
      )}
    >
      {label}
      <span className={cn("tabular rounded-full px-1.5 text-[11px] font-bold", active ? "bg-[rgb(4_19_34/0.18)]" : "bg-surface-3 text-text-3")}>{count}</span>
    </button>
  );
}

function ActionCard({ action: a }: { action: PortalActionItem }) {
  return (
    <li className="card flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={ACTION_STATUS_TONE[a.status]}>{ACTION_STATUS_CLIENT_LABEL[a.status]}</Badge>
        {a.category ? <Badge tone="muted">{a.category}</Badge> : null}
        {a.kind ? <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">{ACTION_KIND_LABEL[a.kind]}</span> : null}
      </div>
      <p className="mt-3 text-[15px] font-semibold leading-snug text-text">{a.title}</p>
      {a.suggestedAt || a.executedAt ? (
        <dl className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-3 text-[12.5px]">
          {a.suggestedAt ? (
            <div className="flex gap-1">
              <dt className="text-text-3">Sugerida em</dt>
              <dd className="tabular font-semibold text-text-2">{formatDate(a.suggestedAt)}</dd>
            </div>
          ) : null}
          {a.executedAt ? (
            <div className="flex gap-1">
              <dt className="text-text-3">Executada em</dt>
              <dd className="tabular font-semibold text-text-2">{formatDate(a.executedAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {a.note ? <p className="mt-3 whitespace-pre-line rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-text-2">{a.note}</p> : null}
    </li>
  );
}
