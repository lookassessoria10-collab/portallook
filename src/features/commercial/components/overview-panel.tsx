import Link from "next/link";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CommercialDashboardVM } from "@/features/commercial/dashboard";
import { AccentCard, ChartPanel, DeltaPill, DeltaText, Pill, SectionLabel, TableFrame, cell, headline } from "./parts";

const word = (vm: CommercialDashboardVM) =>
  vm.unit.singular === "mês" ? { adjective: "mensal", byUnit: "mês a mês" } : vm.unit.singular === "semana" ? { adjective: "semanal", byUnit: "semana a semana" } : { adjective: "por período", byUnit: "período a período" };

/** Visão geral: mês em foco × anterior, acumulado do ano, evolução, tabela e variação período a período. */
export function OverviewPanel({ vm, currency }: { vm: CommercialDashboardVM; currency: string }) {
  const w = word(vm);
  return (
    <div className="space-y-9">
      <section aria-labelledby="foco-titulo">
        <SectionLabel id="foco-titulo" note={vm.focus.note?.title}>
          {vm.focus.name} em foco{vm.focus.previousName ? ` — vs ${vm.focus.previousName}` : ""}
        </SectionLabel>
        <div className="flex flex-col gap-5 rounded-[18px] px-5 py-6 shadow-[0_18px_40px_-24px_rgb(0_120_220/0.55)] ring-1 ring-inset ring-white/10 sm:px-8 md:flex-row md:items-center md:gap-8" style={{ background: "var(--focus-gradient)" }}>
          <div className="shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">{vm.unit.singular === "mês" ? "Mês em foco" : "Em foco"}</p>
            <p className="mt-1 font-serif text-[1.65rem] font-semibold leading-none text-white">{vm.focus.title}</p>
          </div>
          <span className="hidden h-14 w-px bg-white/15 md:block" aria-hidden />
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:flex xl:flex-wrap xl:gap-x-8">
            {vm.banner.map((k) => (
              <div key={k.key} className="min-w-0 xl:min-w-[84px]">
                <dt className="sr-only">{k.label}</dt>
                <dd className="tabular text-[1.25rem] font-bold leading-none text-white">{headline(k.value, k.format, currency)}</dd>
                <dd className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/55 [overflow-wrap:anywhere]" aria-hidden>
                  {k.label}
                </dd>
                <dd className="mt-1.5">
                  <DeltaText delta={k.delta} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {vm.focus.note?.description ? (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-text-3">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {vm.focus.note.description}
          </p>
        ) : null}
        {vm.extraMetrics.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {vm.extraMetrics.map((k) => (
              <div key={k.key} className="card-inset px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">{k.label}</p>
                <p className="tabular mt-1 text-lg font-bold text-text">{headline(k.value, k.format, currency)}</p>
                {k.delta ? (
                  <div className="mt-1">
                    <DeltaPill delta={k.delta} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="acumulado-titulo">
        <SectionLabel id="acumulado-titulo" note={vm.rangeLabel}>
          Acumulado do ano
        </SectionLabel>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
          {vm.accumulated.map((k) => (
            <AccentCard key={k.key} label={k.label} value={headline(k.value, k.format, currency)} sub={k.sub} accent={k.accent} icon={k.icon} />
          ))}
        </div>
      </section>

      {vm.charts.length ? (
        <section aria-labelledby="evolucao-titulo">
          <SectionLabel id="evolucao-titulo">Evolução {w.adjective}</SectionLabel>
          <div className="grid gap-4 lg:grid-cols-2">
            {vm.charts.map((c, i) => (
              <ChartPanel key={c.key} chart={c} points={vm.points} currency={currency} className={vm.charts.length % 2 === 1 && i === vm.charts.length - 1 ? "lg:col-span-2" : undefined} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="detalhamento-titulo">
        <SectionLabel id="detalhamento-titulo" note={vm.months > 1 ? "toque no mês para colocá-lo em foco" : undefined}>
          Detalhamento {w.adjective}
        </SectionLabel>
        <TableFrame caption={`Resultados ${w.byUnit}`}>
          <thead>
            <tr>
              <th scope="col">{vm.unit.singular === "mês" ? "Mês" : "Período"}</th>
              {vm.monthTable.columns.map((c) => (
                <th key={c.key} scope="col" className="text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vm.monthTable.rows.map((r) => (
              <tr key={r.key} className={cn(r.highlight && "[&>*]:bg-primary-soft/40")}>
                <th scope="row" className="text-left font-bold">
                  <span className="inline-flex items-center gap-2">
                    {r.href ? (
                      <Link href={r.href} scroll={false} className="hover:text-primary hover:underline">
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                    {r.badges.map((b) => (
                      <Pill key={b.text} tone={b.tone} title={b.title}>
                        {b.text}
                      </Pill>
                    ))}
                  </span>
                </th>
                {vm.monthTable.columns.map((c) => (
                  <td key={c.key} className={cn("tabular text-right", c.strong && "font-bold")}>
                    {c.badge && r.values[c.key] != null ? <Pill tone={r.tones?.[c.key] ?? "neutral"}>{cell(r.values[c.key], c.format, currency)}</Pill> : cell(r.values[c.key], c.format, currency, c.cents)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {vm.monthTable.total ? (
            <tfoot>
              <tr>
                <th scope="row" className="text-left">
                  Total
                </th>
                {vm.monthTable.columns.map((c) => (
                  <td key={c.key} className="tabular text-right">
                    {cell(vm.monthTable.total?.[c.key], c.format, currency, c.cents)}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </TableFrame>
      </section>

      {vm.variation ? (
        <section aria-labelledby="variacao-titulo">
          <SectionLabel id="variacao-titulo">Variação {w.byUnit}</SectionLabel>
          <TableFrame caption={`Variação ${w.byUnit}`} footnote="Taxas variam em pontos percentuais (p.p.); os demais indicadores, em percentual sobre o período anterior.">
            <thead>
              <tr>
                <th scope="col">Indicador</th>
                {vm.variation.periods.map((p, i) => (
                  <PeriodHead key={p.key} label={p.label} previous={i > 0 ? vm.variation!.periods[i - 1].label : null} />
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.variation.rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="text-left font-bold">
                    {r.label}
                  </th>
                  {r.values.map((v, i) => (
                    <VariationCells key={vm.variation!.periods[i].key} value={cell(v, r.format, currency)} delta={i > 0 ? r.deltas[i] : undefined} />
                  ))}
                </tr>
              ))}
            </tbody>
          </TableFrame>
        </section>
      ) : null}
    </div>
  );
}

/** Cada período seguido da variação em relação ao anterior (Jan | Fev | Δ Jan→Fev | Mar…). */
function PeriodHead({ label, previous }: { label: string; previous: string | null }) {
  return (
    <>
      <th scope="col" className="text-right">
        {label}
      </th>
      {previous ? (
        <th scope="col" className="text-center" title={`Variação de ${previous} para ${label}`}>
          Δ {previous}→{label}
        </th>
      ) : null}
    </>
  );
}

function VariationCells({ value, delta }: { value: string; delta: Parameters<typeof DeltaPill>[0]["delta"] | undefined }) {
  return (
    <>
      <td className="tabular text-right">{value}</td>
      {delta !== undefined ? (
        <td className="text-center">
          <DeltaPill delta={delta} />
        </td>
      ) : null}
    </>
  );
}
