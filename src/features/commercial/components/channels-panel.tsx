import Link from "next/link";
import { cn } from "@/lib/cn";
import { normalizeText } from "@/lib/ids";
import { SECTION_PARAM } from "@/features/portal/params";
import type { CommercialDashboardVM, RoiFigures } from "@/features/commercial/dashboard";
import { notesFor } from "@/features/commercial/notes";
import { ChartPanel, DistributionPanel, NoteBox, Panel, Pill, SectionLabel, TableFrame, cell, perReal, signedPercent } from "./parts";

/** Canais (de onde vieram leads e receita) e retorno dos canais com investimento. */
export function ChannelsPanel({ vm, currency }: { vm: CommercialDashboardVM; currency: string }) {
  const ch = vm.channels;
  return (
    <div className="space-y-9">
      {ch ? (
        <>
          {ch.distributions.length || ch.evolution ? (
            <section aria-labelledby="canais-titulo">
              <SectionLabel id="canais-titulo" note={vm.rangeLabel}>
                Desempenho por canal
              </SectionLabel>
              <div className="grid gap-4 lg:grid-cols-2">
                {ch.distributions.map((d) => (
                  <DistributionPanel key={d.key} spec={d} currency={currency} />
                ))}
                {ch.evolution ? <ChartPanel chart={ch.evolution} points={vm.points} currency={currency} height={320} className="lg:col-span-2" /> : null}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="canais-tabela-titulo">
            <SectionLabel id="canais-tabela-titulo">{ch.hasConversions ? "Conversão e receita por canal" : "Leads e receita por canal"}</SectionLabel>
            <TableFrame caption="Resultados por canal" footnote={ch.hasLeads ? `Colunas dos meses: ${ch.leadsLabel.toLowerCase()} de cada canal. Vazio = não informado na planilha.` : undefined}>
              <thead>
                <tr>
                  <th scope="col">Canal</th>
                  {ch.hasLeads ? ch.table.periods.map((p) => <th key={p.key} scope="col" className="text-right">{p.label}</th>) : null}
                  {ch.hasLeads ? <th scope="col" className="text-right">Total {ch.leadsLabel.toLowerCase()}</th> : null}
                  {ch.conversionsLabel ? <th scope="col" className="text-right">{ch.conversionsLabel}</th> : null}
                  {ch.conversionsLabel ? <th scope="col" className="text-right">Conversão</th> : null}
                  {ch.hasRevenue ? <th scope="col" className="text-right">Receita total</th> : null}
                  {ch.hasRevenue ? <th scope="col" className="text-right">% da receita</th> : null}
                </tr>
              </thead>
              <tbody>
                {ch.table.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="text-left">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} aria-hidden />
                        <span className="font-bold">{r.label}</span>
                        {r.kind !== "other" && normalizeText(r.kindLabel) !== normalizeText(r.label) ? <Pill tone={r.kind === "paid" ? "primary" : r.kind === "recurring" ? "attention" : "neutral"}>{r.kindLabel}</Pill> : null}
                      </span>
                    </th>
                    {ch.hasLeads ? ch.table.periods.map((p) => <td key={p.key} className="tabular text-right text-text-2">{cell(r.byPeriod[p.key], "integer", currency)}</td>) : null}
                    {ch.hasLeads ? <td className="tabular text-right font-bold">{cell(r.leads, "integer", currency)}</td> : null}
                    {ch.conversionsLabel ? <td className="tabular text-right">{cell(r.conversions, "integer", currency)}</td> : null}
                    {ch.conversionsLabel ? (
                      <td className="text-right">{r.conversionRate != null ? <Pill tone={rateTone(r.conversionRate, ch.table.total.conversionRate)}>{cell(r.conversionRate, "percent", currency)}</Pill> : "—"}</td>
                    ) : null}
                    {ch.hasRevenue ? <td className="tabular text-right font-bold">{cell(r.revenue, "currency", currency)}</td> : null}
                    {ch.hasRevenue ? <td className="tabular text-right text-text-2">{cell(r.revenueShare, "percent", currency)}</td> : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="text-left">
                    Total
                  </th>
                  {ch.hasLeads ? ch.table.periods.map((p) => <td key={p.key} className="tabular text-right">{cell(ch.table.total.byPeriod[p.key], "integer", currency)}</td>) : null}
                  {ch.hasLeads ? <td className="tabular text-right">{cell(ch.table.total.leads, "integer", currency)}</td> : null}
                  {ch.conversionsLabel ? <td className="tabular text-right">{cell(ch.table.total.conversions, "integer", currency)}</td> : null}
                  {ch.conversionsLabel ? <td className="tabular text-right">{cell(ch.table.total.conversionRate, "percent", currency)}</td> : null}
                  {ch.hasRevenue ? <td className="tabular text-right">{cell(ch.table.total.revenue, "currency", currency)}</td> : null}
                  {ch.hasRevenue ? <td className="tabular text-right">100%</td> : null}
                </tr>
              </tfoot>
            </TableFrame>
            <NoteBox texts={notesFor(vm.notes, vm.layout, "canais")} />
          </section>
        </>
      ) : null}

      {vm.roi ? <RoiSection vm={vm} currency={currency} /> : null}
    </div>
  );
}

function rateTone(rate: number, overall: number | null) {
  if (overall == null || overall <= 0) return "neutral" as const;
  if (rate >= overall * 0.9) return "positive" as const;
  if (rate >= overall * 0.6) return "primary" as const;
  return "negative" as const;
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-text-3">{label}</span>
      <strong className={cn("tabular text-right", strong ? "text-positive" : "text-text")}>{value}</strong>
    </div>
  );
}

const big = (f: RoiFigures, metric: "roiPercent" | "roas", currency: string) => (metric === "roas" ? cell(f.roas, "multiplier", currency) : signedPercent(f.roi));
const tone = (v: number | null) => (v == null ? "text-text" : v >= 0 ? "text-positive" : "text-negative");

function RoiSection({ vm, currency }: { vm: CommercialDashboardVM; currency: string }) {
  const roi = vm.roi!;
  const metricName = roi.metric === "roas" ? "Retorno" : "ROI";
  const explain =
    roi.basis === "channels"
      ? `O ${metricName} considera apenas a receita dos canais com investimento em mídia (${list(roi.paidNames)}).${roi.otherNames.length ? ` ${list(roi.otherNames)} não ${roi.otherNames.length === 1 ? "entra" : "entram"} neste cálculo por não ter${roi.otherNames.length === 1 ? "" : "em"} custo direto de mídia.` : ""}`
      : roi.basis === "attributed"
        ? `O ${metricName} considera a receita atribuída à mídia informada no Financeiro.`
        : `A planilha não separa a receita dos canais pagos: o ${metricName} usa a receita total do período.`;
  return (
    <>
      <section aria-labelledby="roi-titulo">
        <SectionLabel id="roi-titulo" note={vm.rangeLabel}>
          {metricName} acumulado
        </SectionLabel>
        <p className="-mt-1 mb-4 max-w-3xl text-xs leading-relaxed text-text-2">{explain}</p>
        <NoteBox texts={notesFor(vm.notes, vm.layout, "roi")} className="-mt-1 mb-4 max-w-3xl" />
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[var(--radius-lg)] p-5 shadow-[0_18px_40px_-24px_rgb(0_120_220/0.55)] ring-1 ring-inset ring-white/10" style={{ background: "var(--focus-gradient)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">{metricName} geral · acumulado</p>
            <p className={cn("tabular mt-2 text-[2.1rem] font-bold leading-none", (roi.total.roi ?? 0) >= 0 ? "text-[#6fe3c4]" : "text-[#ff9aa7]")}>{big(roi.total, roi.metric, currency)}</p>
            <p className="mt-1.5 text-xs text-white/60">{vm.rangeShort}</p>
            <div className="my-3.5 h-px bg-white/15" />
            <div className="space-y-1.5 text-xs">
              <p className="flex justify-between gap-3"><span className="text-white/60">Total investido</span><strong className="tabular text-white">{cell(roi.total.investment, "currency", currency)}</strong></p>
              <p className="flex justify-between gap-3"><span className="text-white/60">Receita gerada</span><strong className="tabular text-white">{cell(roi.total.revenue, "currency", currency)}</strong></p>
              <p className="flex justify-between gap-3"><span className="text-white/60">Por R$ 1,00 investido</span><strong className="tabular text-[#6fe3c4]">{perReal(roi.total.roas, currency)} retornaram</strong></p>
            </div>
          </div>
          {roi.channels.map((c) => (
            <Panel key={c.key} className="p-5 sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">{metricName} {c.label} · acumulado</p>
              <p className={cn("tabular mt-2 text-[2.1rem] font-bold leading-none", tone(c.roi))}>{big(c, roi.metric, currency)}</p>
              <p className="mt-1.5 text-xs text-text-3">{c.kindLabel}</p>
              <div className="my-3.5 h-px bg-border-strong" />
              <div className="space-y-1.5">
                <Figure label="Total investido" value={cell(c.investment, "currency", currency)} />
                <Figure label="Receita gerada" value={cell(c.revenue, "currency", currency)} />
                <Figure label="Por R$ 1,00 investido" value={`${perReal(c.roas, currency)} retornaram`} strong />
              </div>
              <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-chart-track">
                <div className="h-full rounded-full" style={{ width: `${Math.round(c.bar * 100)}%`, background: c.color }} />
              </div>
            </Panel>
          ))}
        </div>
      </section>

      {roi.table.length ? (
        <section aria-labelledby="roi-mes-titulo">
          <SectionLabel id="roi-mes-titulo">{metricName} por canal — detalhamento {vm.unit.singular === "mês" ? "mensal" : "por período"}</SectionLabel>
          <TableFrame caption={`${metricName} por canal pago e período`} footnote={`Resultado líquido = receita do canal − investimento. ${metricName === "ROI" ? "ROI = resultado líquido ÷ investimento. " : ""}Retorno por R$ 1 = receita ÷ investimento.`}>
            <thead>
              <tr>
                <th scope="col">Canal</th>
                <th scope="col">{vm.unit.singular === "mês" ? "Mês" : "Período"}</th>
                <th scope="col" className="text-right">Investimento</th>
                <th scope="col" className="text-right">Receita gerada</th>
                <th scope="col" className="text-right">Resultado líquido</th>
                <th scope="col" className="text-right">ROI</th>
                <th scope="col" className="text-right">Retorno por R$ 1</th>
              </tr>
            </thead>
            <tbody>
              {roi.table.map((g) =>
                g.rows.map((r, i) => (
                  <tr key={`${g.key}-${r.key}`} className={cn(r.focus && "[&>*]:bg-primary-soft/40", i === 0 && "[&>*]:border-t [&>*]:border-t-border-strong")}>
                    {i === 0 ? (
                      <th scope="rowgroup" rowSpan={g.rows.length} className="border-r border-border align-top font-bold">
                        {g.label}
                      </th>
                    ) : null}
                    <td className={cn(r.focus && "font-bold")}>{r.label}</td>
                    <td className="tabular text-right">{cell(r.investment, "currency", currency, true)}</td>
                    <td className="tabular text-right">{cell(r.revenue, "currency", currency)}</td>
                    <td className={cn("tabular text-right font-bold", tone(r.net))}>{r.net == null ? "—" : `${r.net >= 0 ? "+" : "−"} ${cell(Math.abs(r.net), "currency", currency)}`}</td>
                    <td className={cn("tabular text-right font-bold", tone(r.roi))}>{signedPercent(r.roi)}</td>
                    <td className="tabular text-right">{perReal(r.roas, currency)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </TableFrame>
        </section>
      ) : null}

      {roi.months.length ? (
        <section aria-labelledby="roi-cards-titulo">
          <SectionLabel id="roi-cards-titulo">{metricName} {vm.unit.singular === "mês" ? "mês a mês" : "período a período"}</SectionLabel>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {roi.months.map((m) => (
              <Panel key={m.key} className={cn("p-5 sm:p-5", m.focus && "ring-1 ring-inset ring-[rgb(0_174_239/0.4)]")}>
                <div className="mb-3.5 flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-text-2">
                    {m.href ? (
                      <Link href={`${m.href}&${SECTION_PARAM}=canais`} scroll={false} className="truncate hover:text-primary">
                        {m.label}
                      </Link>
                    ) : (
                      <span className="truncate">{m.label}</span>
                    )}
                    {m.best ? <Pill tone="attention">Melhor {vm.unit.singular}</Pill> : null}
                    {m.focus ? <Pill tone="primary">Em foco</Pill> : null}
                  </p>
                  <span className={cn("tabular shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold", (m.roi ?? 0) >= 0 ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative")}>
                    {roi.channels.length > 1 ? "Mix: " : ""}
                    {big(m, roi.metric, currency)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Figure label="Total investido" value={cell(m.investment, "currency", currency, true)} />
                  <Figure label={roi.basis === "channels" ? "Receita dos canais pagos" : "Receita considerada"} value={cell(m.revenue, "currency", currency)} />
                  <Figure label="Para cada R$ 1,00 investido" value={`${perReal(m.roas, currency)} retornaram`} />
                </div>
                {m.channels.length > 1 ? (
                  <>
                    <div className="my-3 h-px bg-border" />
                    <div className="space-y-1.5">
                      {m.channels.map((c) => (
                        <div key={c.key} className="flex justify-between gap-3 text-xs">
                          <span className="text-text-3">
                            {metricName} {c.label}
                          </span>
                          <strong className={cn("tabular", tone(c.roi))}>{roi.metric === "roas" ? cell(c.roas, "multiplier", currency) : signedPercent(c.roi)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-chart-track">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--dash-7)] to-[var(--primary)]" style={{ width: `${Math.round(m.bar * 100)}%` }} />
                </div>
                {m.note ? <p className="mt-2 text-[11px] text-text-3">{m.note}</p> : null}
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      {roi.chart ? (
        <section aria-labelledby="roi-evolucao-titulo">
          <SectionLabel id="roi-evolucao-titulo">Evolução do {metricName}</SectionLabel>
          <ChartPanel chart={roi.chart} points={vm.points} currency={currency} height={230} />
        </section>
      ) : null}
    </>
  );
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

