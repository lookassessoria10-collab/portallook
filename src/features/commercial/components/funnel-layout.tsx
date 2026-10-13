import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { formatInteger, formatPercent } from "@/lib/format/number";
import { lowerFirst, singularizePt } from "@/lib/format/text";
import { returnTone, type CommercialDashboardVM, type FunnelLayoutView, type RoiFigures } from "@/features/commercial/dashboard";
import { notesFor, unplacedNotes } from "@/features/commercial/notes";
import { AccentCard, ChartPanel, DistributionFigure, NoteBox, Panel, PanelHead, Pill, SectionHead, TableFrame, cell, headline, perReal, signedPercent } from "./parts";
import { ComparisonTable, FreeTable, LooseNotes, OpportunityBlock } from "./shared-blocks";
import { INSIGHT_COLOR } from "./insights-panel";

type Props = { vm: CommercialDashboardVM; fv: FunnelLayoutView; currency: string };

const TONE_TEXT = { positive: "text-positive", attention: "text-attention", negative: "text-negative", neutral: "text-text", info: "text-info", primary: "text-primary" } as const;
const TONE_BORDER = { positive: "var(--positive)", attention: "var(--attention)", negative: "var(--negative)", neutral: "var(--border-strong)", info: "var(--info)", primary: "var(--primary)" } as const;

const returnText = (f: RoiFigures, metric: "roas" | "roiPercent", currency: string) => (metric === "roas" ? cell(f.roas, "multiplier", currency) : signedPercent(f.roi));
const finalShort = (vm: CommercialDashboardVM) => (vm.finalStageLabel.length > 8 ? `${vm.finalStageLabel.slice(0, 4)}.` : vm.finalStageLabel);

/** Visão geral do modelo "funil": acumulado, funil do mês, mídia e receita por canal e distribuição de leads. */
export function FunnelOverview({ vm, fv, currency }: Props) {
  const notes = (slot: string) => notesFor(vm.notes, vm.layout, slot);
  const ch = fv.focusChannels;
  const month = vm.focus.name;
  const comp = finalShort(vm);
  return (
    <div className="space-y-10">
      <section aria-labelledby="f-acumulado">
        <SectionHead id="f-acumulado" eyebrow={`01 — Acumulado ${vm.year}`} title={`Indicadores consolidados — ${vm.rangeLabel}`} />
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
          {fv.accumulated.map((k) => (
            <AccentCard key={k.key} label={k.label} value={headline(k.value, k.format, currency)} sub={k.sub} accent={k.accent} icon={k.icon} highlight={k.highlight} />
          ))}
        </div>
        {vm.extraMetrics.length ? (
          <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {vm.extraMetrics.map((k) => (
              <div key={k.key} className="card-inset px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">{k.label}</p>
                <p className="tabular mt-1 text-lg font-bold text-text">{headline(k.value, k.format, currency)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <NoteBox texts={notes("acumulado")} />
      </section>

      <section aria-labelledby="f-funil">
        <SectionHead id="f-funil" eyebrow={`02 — ${vm.focus.title} em detalhe`} title="Funil e conversão do mês" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Panel>
            <PanelHead title="Funil de conversão" />
            <p className="-mt-2 mb-4 text-xs text-text-3">Do primeiro contato até {lowerFirst(singularizePt(vm.finalStageLabel))}.</p>
            <ol className="space-y-2">
              {fv.funnel.stages.map((s, i) => (
                <Fragment key={s.key}>
                  {i > 0 ? (
                    <li className="pl-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-3" aria-hidden>
                      ↓ {fv.funnel.steps[i - 1].label} <strong className="ml-1 text-primary">{formatPercent(fv.funnel.steps[i - 1].rate)}</strong>
                    </li>
                  ) : null}
                  <li
                    className="flex h-11 min-w-[200px] items-center justify-between rounded-[10px] px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_-10px_rgb(0_120_220/0.8)]"
                    style={{ width: `${Math.round(s.width * 100)}%`, background: ["linear-gradient(90deg,#0f3f7a,#1468b8)", "linear-gradient(90deg,#1468b8,#1b8fd6)", "linear-gradient(90deg,#1b8fd6,#22b5f2)", "linear-gradient(90deg,#22b5f2,#5cd0f5)"][Math.min(i, 3)] }}
                  >
                    <span className="truncate">{s.label}</span>
                    <span className="tabular">{formatInteger(s.value)}</span>
                  </li>
                </Fragment>
              ))}
              {fv.funnel.overall ? (
                <li className="pl-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-3">
                  {fv.funnel.overall.label} <strong className="ml-1 text-primary">{formatPercent(fv.funnel.overall.rate)}</strong>
                </li>
              ) : null}
            </ol>
            <NoteBox texts={notes("funil")} />
          </Panel>
          {fv.funnel.rates ? (
            <Panel>
              <PanelHead title={fv.funnel.rates.title} unit={fv.funnel.rates.unit} />
              <DistributionFigure spec={fv.funnel.rates} currency={currency} height={170} />
              <NoteBox texts={notes("taxas")} />
            </Panel>
          ) : null}
        </div>
      </section>

      {ch ? (
        <section aria-labelledby="f-midia">
          <SectionHead id="f-midia" eyebrow="03 — Mídia e receita" title={`Investimento e retorno por canal — ${month}`} />
          <div className="grid gap-4 lg:grid-cols-2">
            {ch.paid.length ? (
              <Panel>
                <PanelHead title="Investimento em mídia" unit="canais pagos" />
                {ch.investment ? <DistributionFigure spec={ch.investment} currency={currency} height={190} /> : null}
                <TableFrame caption={`Investimento por canal em ${month}`}>
                  <thead>
                    <tr>
                      <th scope="col">Canal</th>
                      <th scope="col" className="text-right">
                        Investimento
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ch.paid.map((c) => (
                      <tr key={c.key}>
                        <th scope="row" className="text-left font-semibold">
                          <Dot color={c.color} />
                          {c.label}
                        </th>
                        <td className="tabular text-right">{cell(c.investment, "currency", currency, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className="text-left">
                        Total
                      </th>
                      <td className="tabular text-right">{cell(ch.total.investment, "currency", currency, true)}</td>
                    </tr>
                  </tfoot>
                </TableFrame>
                <NoteBox texts={notes("investimento")} />
              </Panel>
            ) : null}
            <Panel className={ch.paid.length ? undefined : "lg:col-span-2"}>
              <PanelHead title="Receita por canal" />
              <p className="-mt-2 mb-4 text-xs text-text-3">Origem dos {cell(ch.total.revenue, "currency", currency, true)} em {month}.</p>
              <TableFrame caption={`Receita por canal em ${month}`}>
                <thead>
                  <tr>
                    <th scope="col">Canal</th>
                    {ch.hasConversions ? (
                      <th scope="col" className="text-right" title={vm.finalStageLabel}>
                        {comp}
                      </th>
                    ) : null}
                    <th scope="col" className="text-right">
                      Receita
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ch.rows.map((c) => (
                    <tr key={c.key}>
                      <th scope="row" className="text-left font-semibold">
                        <Dot color={c.color} />
                        {c.label}
                      </th>
                      {ch.hasConversions ? <td className="tabular text-right">{cell(c.conversions, "integer", currency)}</td> : null}
                      <td className="tabular text-right">{cell(c.revenue, "currency", currency, true)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="text-left">
                      Total
                    </th>
                    {ch.hasConversions ? <td className="tabular text-right">{cell(ch.total.conversions, "integer", currency)}</td> : null}
                    <td className="tabular text-right">{cell(ch.total.revenue, "currency", currency, true)}</td>
                  </tr>
                </tfoot>
              </TableFrame>
              <NoteBox texts={notes("receita")} />
            </Panel>
          </div>
        </section>
      ) : null}

      {ch?.hasLeads ? (
        <section aria-labelledby="f-leads">
          <SectionHead id="f-leads" eyebrow="04 — Distribuição de leads" title={`Volume de ${lowerFirst(vm.firstStageLabel)} por canal — ${month}`} />
          <div className="grid gap-4 lg:grid-cols-2">
            {ch.leads ? (
              <Panel>
                <PanelHead title={`${vm.firstStageLabel} por canal`} unit={month} />
                <p className="-mt-2 mb-4 text-xs text-text-3">
                  {formatInteger(ch.total.leads)} {lowerFirst(vm.firstStageLabel)} captados no período.
                </p>
                <DistributionFigure spec={ch.leads} currency={currency} />
              </Panel>
            ) : null}
            <Panel className={ch.leads ? undefined : "lg:col-span-2"}>
              <PanelHead title="Leitura estratégica" />
              <p className="-mt-2 mb-4 text-xs text-text-3">O que os números dizem sobre os canais.</p>
              <TableFrame caption={`${vm.firstStageLabel} e conversão por canal em ${month}`}>
                <thead>
                  <tr>
                    <th scope="col">Canal</th>
                    <th scope="col" className="text-right">
                      {vm.firstStageLabel}
                    </th>
                    {ch.hasConversions ? (
                      <th scope="col" className="text-right" title={vm.finalStageLabel}>
                        {comp}
                      </th>
                    ) : null}
                    {ch.hasConversions ? (
                      <th scope="col" className="text-right">
                        Conversão
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {[...ch.rows]
                    .sort((a, b) => (b.leads ?? -1) - (a.leads ?? -1))
                    .map((c) => (
                      <tr key={c.key}>
                        <th scope="row" className="text-left font-semibold">
                          <Dot color={c.color} />
                          {c.label}
                        </th>
                        <td className="tabular text-right">{cell(c.leads, "integer", currency)}</td>
                        {ch.hasConversions ? <td className="tabular text-right">{cell(c.conversions, "integer", currency)}</td> : null}
                        {ch.hasConversions ? <td className={cn("tabular text-right", (c.conversionRate ?? 0) >= (vm.funnelView?.funnel.overall?.rate ?? Infinity) && "font-bold text-positive")}>{cell(c.conversionRate, "percent", currency)}</td> : null}
                      </tr>
                    ))}
                </tbody>
              </TableFrame>
              <NoteBox texts={notes("leads")} label="Leitura" />
            </Panel>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: color }} aria-hidden />;
}

/** Comparativo mensal: todos os indicadores, um mês por coluna, com o acumulado. */
export function FunnelComparativo({ vm, fv, currency }: Props) {
  const { periods, groups } = fv.comparativo;
  const cols = periods.length + 2;
  return (
    <div className="space-y-10">
      <section aria-labelledby="f-comparativo">
        <SectionHead id="f-comparativo" eyebrow={`Comparativo ${vm.unit.singular === "mês" ? "mensal" : "por período"} ${vm.year}`} title={`Evolução de todos os indicadores ${vm.unit.singular === "mês" ? "por mês" : "por período"}`} />
        <TableFrame caption="Comparativo de todos os indicadores por período" footnote={vm.unit.singular === "mês" ? "Meses em branco (—) ainda não têm dados. A tabela é atualizada todo mês." : undefined}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[2] bg-surface-2">
                Indicador
              </th>
              {periods.map((p) => (
                <th key={p.key} scope="col" className={cn("text-right", p.focus && "bg-primary-soft text-primary")}>
                  {p.label}
                  {p.focus ? " ★" : ""}
                </th>
              ))}
              <th scope="col" className="text-right">
                Acum.
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <tr>
                  <td colSpan={cols} className="border-t border-t-border-strong bg-surface-2/70 !py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                    {g.label}
                  </td>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="sticky left-0 z-[1] bg-surface text-left font-semibold">
                      {r.label}
                    </th>
                    {periods.map((p) => {
                      const value = r.values[p.key];
                      return (
                        <td key={p.key} className={cn("tabular text-right", p.focus && "bg-primary-soft/40 font-bold", value == null && "text-text-3", r.rated && value != null && TONE_TEXT[returnTone(rated(value, r.format))])}>
                          {cell(value, r.format, currency, r.cents)}
                        </td>
                      );
                    })}
                    <td className="tabular text-right font-bold">{cell(r.total, r.format, currency, r.cents)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </TableFrame>
        <NoteBox texts={notesFor(vm.notes, vm.layout, "comparativo")} />
      </section>

      {fv.trendCharts.length ? (
        <section aria-labelledby="f-tendencia">
          <SectionHead id="f-tendencia" eyebrow="Visualização gráfica" title="Tendência dos principais indicadores" />
          <div className="grid gap-4 lg:grid-cols-2">
            {fv.trendCharts.map((c) => (
              <ChartPanel key={c.key} chart={c} points={vm.points} currency={currency} height={300} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** ROI em percentual vira o retorno por R$ 1 só para escolher a cor. */
const rated = (value: number, format: string) => (format === "percent" ? value + 1 : value);

/** Retorno geral e por canal pago: destaque do acumulado, evolução, tabela mês a mês e cartões canal a canal. */
export function FunnelRoi({ vm, fv, currency }: Props) {
  const roi = fv.roi!;
  const name = roi.metric === "roas" ? "Retorno" : "ROI";
  const notes = (slot: string) => notesFor(vm.notes, vm.layout, slot);
  return (
    <div className="space-y-10">
      <section aria-labelledby="f-roi">
        <SectionHead id="f-roi" eyebrow={`${name} geral`} title={`Retorno sobre o investimento — acumulado ${vm.year}`} />
        <div className="grid items-center gap-6 rounded-[var(--radius-lg)] border border-[rgb(0_174_239/0.25)] bg-[linear-gradient(135deg,rgb(0_174_239/0.12),var(--surface))] p-6 sm:p-7 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-3">
              {name} acumulado ({fv.rangeArrow})
            </p>
            <p className={cn("tabular mt-2 text-[3.4rem] font-black leading-none tracking-tight", TONE_TEXT[returnTone(roi.overall.roas)])}>{returnText(roi.overall, roi.metric, currency)}</p>
            <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-text-2">
              {roi.story.map((s) => (
                <p key={s}>{s}</p>
              ))}
            </div>
            <NoteBox texts={notes("roi")} />
          </div>
          {roi.bars ? <DistributionFigure spec={roi.bars} currency={currency} height={140} /> : null}
        </div>
      </section>

      <section aria-labelledby="f-roi-mes">
        <SectionHead id="f-roi-mes" eyebrow={`${name} por ${vm.unit.singular}`} title="Evolução do retorno mês a mês" />
        {roi.chart ? <ChartPanel chart={roi.chart} points={vm.points} currency={currency} height={300} className="mb-4" /> : null}
        <TableFrame caption={`${name} geral e por canal, por período`}>
          <thead>
            <tr>
              <th scope="col">{vm.unit.singular === "mês" ? "Mês" : "Período"}</th>
              <th scope="col" className="text-right">
                Invest. total
              </th>
              <th scope="col" className="text-right">
                Receita
              </th>
              <th scope="col" className="text-right">
                {name} geral
              </th>
              {roi.channels.map((c) => (
                <Fragment key={c.key}>
                  <th scope="col" className="text-right">
                    Invest. {c.label}
                  </th>
                  <th scope="col" className="text-right">
                    Receita {c.label}
                  </th>
                  <th scope="col" className="text-right">
                    {name} {c.label}
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {roi.months.map((m) => (
              <tr key={m.key} className={cn(m.focus && "[&>*]:bg-primary-soft/40 [&>*]:font-semibold")}>
                <th scope="row" className="text-left font-semibold">
                  {m.label}
                  {m.focus ? " ★" : ""}
                </th>
                <td className="tabular text-right">{cell(m.overall.investment, "currency", currency, true)}</td>
                <td className="tabular text-right">{cell(m.overall.revenue, "currency", currency, true)}</td>
                <td className={cn("tabular text-right font-bold", TONE_TEXT[returnTone(m.overall.roas)])}>{returnText(m.overall, roi.metric, currency)}</td>
                {roi.channels.map((c) => {
                  const f = m.channels[c.key];
                  return (
                    <Fragment key={c.key}>
                      <td className="tabular text-right">{cell(f?.investment, "currency", currency, true)}</td>
                      <td className="tabular text-right">{cell(f?.revenue, "currency", currency, true)}</td>
                      <td className={cn("tabular text-right font-bold", f?.roas != null && TONE_TEXT[returnTone(f.roas)])}>{f ? returnText(f, roi.metric, currency) : "—"}</td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="text-left">
                Acumulado
              </th>
              <td className="tabular text-right">{cell(roi.total.overall.investment, "currency", currency, true)}</td>
              <td className="tabular text-right">{cell(roi.total.overall.revenue, "currency", currency, true)}</td>
              <td className="tabular text-right">{returnText(roi.total.overall, roi.metric, currency)}</td>
              {roi.channels.map((c) => {
                const f = roi.total.channels[c.key];
                return (
                  <Fragment key={c.key}>
                    <td className="tabular text-right">{cell(f?.investment, "currency", currency, true)}</td>
                    <td className="tabular text-right">{cell(f?.revenue, "currency", currency, true)}</td>
                    <td className="tabular text-right">{f ? returnText(f, roi.metric, currency) : "—"}</td>
                  </Fragment>
                );
              })}
            </tr>
          </tfoot>
        </TableFrame>
      </section>

      {roi.cards.length ? (
        <section aria-labelledby="f-canal-a-canal">
          <SectionHead id="f-canal-a-canal" eyebrow="Canal a canal" title="Desempenho detalhado de cada canal pago" />
          <div className="grid gap-3.5 md:grid-cols-2">
            {roi.cards.map((c) => {
              const tone = returnTone(c.roas);
              return (
                <article key={c.key} className={cn("card min-w-0 border-l-4 p-5", c.focus && "ring-1 ring-inset ring-[rgb(0_174_239/0.35)]")} style={{ borderLeftColor: TONE_BORDER[tone] }}>
                  <h3 className="text-[13px] font-bold text-text">
                    {c.channel} — {c.month}
                    {c.focus ? " ★" : ""}
                  </h3>
                  <p className={cn("tabular mb-3 mt-2 text-[1.6rem] font-extrabold leading-none tracking-tight", TONE_TEXT[tone])}>{returnText(c, roi.metric, currency)}</p>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-text-3">Investimento</dt>
                    <dd className="tabular text-right font-semibold text-text">{cell(c.investment, "currency", currency, true)}</dd>
                    {c.leads != null ? (
                      <>
                        <dt className="text-text-3">{vm.firstStageLabel}</dt>
                        <dd className="tabular text-right font-semibold text-text">{formatInteger(c.leads)}</dd>
                      </>
                    ) : null}
                    {c.conversions != null ? (
                      <>
                        <dt className="text-text-3">{vm.finalStageLabel}</dt>
                        <dd className="tabular text-right font-semibold text-text">{formatInteger(c.conversions)}</dd>
                      </>
                    ) : null}
                    <dt className="text-text-3">Receita</dt>
                    <dd className="tabular text-right font-semibold text-text">{cell(c.revenue, "currency", currency, true)}</dd>
                    <dt className="text-text-3">Por R$ 1,00 investido</dt>
                    <dd className="tabular text-right font-semibold text-text">{perReal(c.roas, currency)}</dd>
                  </dl>
                </article>
              );
            })}
          </div>
          <NoteBox texts={notes("canais")} />
        </section>
      ) : null}
    </div>
  );
}

/** Diagnóstico: leitura da Look, agenda já marcada, oportunidade de crescimento e plano de ação. */
export function FunnelDiagnostico({ vm, fv, currency }: Props) {
  const notes = (slot: string) => notesFor(vm.notes, vm.layout, slot);
  // Na ordem da planilha: a leitura segue o raciocínio de quem escreveu.
  const insights = vm.insights;
  const loose = unplacedNotes(vm.notes, vm.layout, vm.dimensions.map((d) => d.label));
  const g = fv.growth;
  const final = lowerFirst(vm.finalStageLabel);
  return (
    <div className="space-y-10">
      {insights.length ? (
        <section aria-labelledby="f-diagnostico">
          <SectionHead id="f-diagnostico" eyebrow="Leitura estratégica" title={`Diagnóstico consolidado — ${vm.focus.title}`} />
          <ul className="grid gap-3 md:grid-cols-2">
            {insights.map((i) => (
              <li key={i.id} className="card-inset flex gap-3 px-4 py-3.5 text-[13px] leading-relaxed text-text-2">
                <span className="text-lg font-black leading-none" style={{ color: INSIGHT_COLOR[i.type] }} aria-hidden>
                  ›
                </span>
                <p>
                  <strong className="text-text">{i.title}.</strong> {i.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {vm.comparison?.hasNotes ? (
        <section aria-labelledby="f-comparativo-leituras">
          <SectionHead id="f-comparativo-leituras" eyebrow="Comparativo" title={`${vm.comparison.previousName} vs ${vm.comparison.currentName}`} />
          <ComparisonTable comparison={vm.comparison} currency={currency} />
        </section>
      ) : null}

      {vm.opportunities.map((o) => (
        <section key={o.key} aria-labelledby={`f-op-${o.key}`}>
          <SectionHead id={`f-op-${o.key}`} eyebrow="Oportunidades abertas" title={o.title} />
          <OpportunityBlock opportunity={o} focusName={vm.focus.name} nextName={vm.nextName} currency={currency} notes={notes("oportunidades")} />
        </section>
      ))}

      {g ? (
        <section aria-labelledby="f-crescimento">
          <SectionHead id="f-crescimento" eyebrow="Oportunidade de crescimento" title={`Potencial com o volume de ${g.peakName}`} />
          <div className="grid items-center gap-6 rounded-[var(--radius-lg)] p-6 text-white shadow-[0_18px_40px_-24px_rgb(0_120_220/0.55)] ring-1 ring-inset ring-white/10 sm:p-8 md:grid-cols-[1fr_auto]" style={{ background: "var(--focus-gradient)" }}>
            <div>
              <p className="text-2xl font-extrabold leading-tight tracking-tight sm:text-[1.75rem]">
                {formatInteger(g.peakLeads)} {lowerFirst(vm.firstStageLabel)} × {formatPercent(g.conversion)} de conversão
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-white/85">
                Se a conversão de {vm.focus.name} ({formatPercent(g.conversion)}) se mantiver com o volume de {lowerFirst(vm.firstStageLabel)} de {g.peakName} ({formatInteger(g.peakLeads)}): ~{formatInteger(g.projected)} {final} × ticket de {cell(g.ticket, "currency", currency)} = ~{cell(g.revenue, "currency", currency)}. Um crescimento de +{formatPercent(g.growth, 0)} sobre {vm.focus.name}
                {g.peakInvestment != null ? `, com investimento na faixa do que foi feito em ${g.peakName} (${cell(g.peakInvestment, "currency", currency)})` : ""}. O desafio é escalar o volume sem perder a qualificação.
              </p>
            </div>
            <div className="md:text-right">
              <p className="tabular text-5xl font-black leading-none tracking-tight">+{formatPercent(g.growth, 0)}</p>
              <p className="mt-1.5 text-sm text-white/80">
                ≈ +{formatInteger(g.extra)} {final}/{vm.unit.singular}
              </p>
            </div>
          </div>
          <NoteBox texts={notes("crescimento")} />
        </section>
      ) : null}

      {vm.actionPlans.map((p) => (
        <section key={p.key} aria-labelledby={`f-plano-${p.key}`}>
          <SectionHead id={`f-plano-${p.key}`} eyebrow={p.table.title} title={vm.nextName ? `Próximas prioridades — ${vm.nextName}` : "Próximas prioridades"} />
          <FreeTable table={p.table} />
          <NoteBox texts={notes("plano")} />
        </section>
      ))}

      {vm.tables.map((t) => (
        <section key={t.key} aria-labelledby={`f-tabela-${t.key}`}>
          <SectionHead id={`f-tabela-${t.key}`} eyebrow="Tabela" title={t.title} />
          <FreeTable table={t} />
        </section>
      ))}

      {loose.length ? (
        <section aria-labelledby="f-notas">
          <SectionHead id="f-notas" eyebrow="Notas" title="Notas da Look" />
          <LooseNotes notes={loose} />
        </section>
      ) : null}

      {!insights.length && !vm.opportunities.length && !g && !vm.actionPlans.length && !vm.tables.length && !loose.length ? (
        <p className="text-sm text-text-3">
          <Pill tone="neutral">Sem diagnóstico</Pill> A equipe da Look ainda não escreveu a leitura de {vm.focus.name}.
        </p>
      ) : null}
    </div>
  );
}
