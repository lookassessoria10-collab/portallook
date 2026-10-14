"use client";

import { LazyDistributionChart, LazyXYChart } from "@/components/charts/lazy";
import type { SeriesPoint } from "@/components/charts/types";
import type { XYSeries, XYKind } from "@/components/charts/xy-chart";
import type { DistributionSlice } from "@/components/charts/distribution-chart";
import type { ValueFormat } from "@/lib/format/number";
import { serenityMonths, serenityChannels, serenityServices, serenityTherapists, isaborMonths } from "@/features/commercial/reference-data";

/**
 * Gráficos dos relatórios originais, usando os mesmos componentes Recharts,
 * cores e tooltips do Portal Look. Não há dados duplicados nem estimativas.
 */
const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;
const series = (key: string, label: string, format: ValueFormat, colorIndex = 0): XYSeries =>
  ({ key, label, format, color: PALETTE[colorIndex % PALETTE.length] });
const slices = (items: Array<{ label: string; value: number }>): DistributionSlice[] =>
  items.map((item, i) => ({ key: String(i), label: item.label, value: item.value, color: PALETTE[i % PALETTE.length] }));

function Panel({ title, subtitle, children, note }: { title: string; subtitle?: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label={title}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-text">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-text-3">{subtitle}</p> : null}
      </div>
      {children}
      {note ? <p className="mt-3 text-xs leading-relaxed text-text-3">{note}</p> : null}
    </section>
  );
}

function Legend({ items }: { items: XYSeries[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => <li key={item.key} className="flex items-center gap-1.5 text-xs text-text-2">
        <span className="size-2.5 rounded-sm" style={{ background: item.color }} aria-hidden />
        {item.label}
      </li>)}
    </ul>
  );
}

function Trend({ title, subtitle, points, lines, kind = "bar", note, height = 270 }: {
  title: string; subtitle?: string; points: SeriesPoint[]; lines: XYSeries[];
  kind?: XYKind; note?: string; height?: number;
}) {
  return <Panel title={title} subtitle={subtitle} note={note}>
    <Legend items={lines} />
    <LazyXYChart points={points} series={lines} kind={kind} currency="BRL" height={height} highlight={points.at(-1)?.key} />
  </Panel>;
}

function Distribution({ title, subtitle, items, kind = "donut", format = "integer", note, height = 275 }: {
  title: string; subtitle?: string; items: Array<{ label: string; value: number }>;
  kind?: "bars" | "donut"; format?: ValueFormat; note?: string; height?: number;
}) {
  return <Panel title={title} subtitle={subtitle} note={note}>
    <LazyDistributionChart slices={slices(items)} kind={kind} format={format} currency="BRL" height={height} labelWidth={126} />
  </Panel>;
}

const serenityPoints = serenityMonths.map((m) => ({ key: m.short, label: m.short, fullLabel: m.label, values: {
  revenue: m.revenue, leads: m.leads, bookings: m.bookings, attended: m.attended,
  conversion: m.attended / m.leads, newCustomers: m.newCustomers, returning: m.returning,
  paidRevenue: m.metaRevenue + m.sitesRevenue,
  metaRevenue: m.metaRevenue, sitesRevenue: m.sitesRevenue,
  mixRoi: (m.metaRevenue + m.sitesRevenue) / (m.metaSpend + m.sitesSpend) - 1,
  metaRoi: m.metaRevenue / m.metaSpend - 1, sitesRoi: m.sitesRevenue / m.sitesSpend - 1,
} })) satisfies SeriesPoint[];

export function SerenityOverviewCharts() {
  return <section aria-label="Evolução mensal da Serenity" className="space-y-4">
    <h2 className="text-lg font-bold text-text">Evolução mensal</h2>
    <div className="grid gap-4 lg:grid-cols-2">
      <Trend title="Receita por Mês" subtitle="R$" points={serenityPoints} lines={[series("revenue", "Receita", "currency")]} />
      <Trend title="Leads vs Comparecimentos" subtitle="Quantidade por mês" points={serenityPoints} lines={[series("leads", "Leads", "integer"), series("attended", "Comparecimentos", "integer", 1)]} note="Setembro: 41 leads registrados (captura incompleta)." />
      <Trend title="Taxa de Conversão" subtitle="% dos leads que compareceram" points={serenityPoints} lines={[series("conversion", "Conversão", "percent", 2)]} kind="line" note="Setembro (87,8%) é uma taxa distorcida pelos 41 leads incompletos." />
      <Trend title="Novos vs Recorrentes" subtitle="Comparecimentos por perfil" points={serenityPoints} lines={[series("newCustomers", "Novos clientes", "integer"), series("returning", "Recorrentes", "integer", 3)]} kind="stacked" />
    </div>
  </section>;
}

export function SerenityChannelCharts() {
  return <section aria-label="Distribuição dos canais de aquisição" className="grid gap-4 lg:grid-cols-2">
    <Distribution title="Leads por Canal" subtitle="Acumulado informado na origem" kind="bars"
      items={serenityChannels.map((c) => ({ label: c.label, value: Number.parseInt(c.totalLeads.replace(/[^\d]/g, ""), 10) || 0 }))}
      note="Valores com + são mínimos documentados; setembro tem atribuição parcial." />
    <Distribution title="Receita por Canal" subtitle="R$ acumulado" kind="bars" format="currency"
      items={serenityChannels.map((c) => ({ label: c.label, value: c.revenue }))} />
    <div className="lg:col-span-2">
      <Trend title="Receita dos Canais Pagos — Evolução Mensal" subtitle="ADS Meta e Sites de Massagem, R$"
        kind="stacked" points={serenityPoints}
        lines={[series("metaRevenue", "Meta Ads", "currency"), series("sitesRevenue", "Sites de Massagem", "currency", 1)]}
        note="A série mensal por canal se limita aos canais pagos com valores por mês confirmados no original." />
    </div>
  </section>;
}

export function SerenityRoiCharts() {
  return <section aria-label="Evolução do ROI dos canais pagos" className="space-y-4">
    <h2 className="text-lg font-bold text-text">Evolução do ROI Mensal</h2>
    <div className="grid gap-4 lg:grid-cols-2">
      <Trend title="ROI Geral — Mix de Canais Pagos" subtitle="% · Receita paga e investimento em mídia" points={serenityPoints}
        kind="line" lines={[series("mixRoi", "ROI geral pago", "percent")]}
        note="ROI = (receita dos canais pagos − investimento) ÷ investimento. Não utiliza a receita total da clínica." />
      <Trend title="ROI por Canal Pago" subtitle="% por mês" points={serenityPoints} kind="line"
        lines={[series("metaRoi", "ADS Meta", "percent", 1), series("sitesRoi", "Sites de Massagem", "percent", 2)]} />
    </div>
  </section>;
}

const servicePoints = serenityMonths.map((m, i) => ({
  key: m.short, label: m.short, fullLabel: m.label,
  values: Object.fromEntries(serenityServices.map((s) => [s.label, s.counts[i]])),
})) satisfies SeriesPoint[];

export function SerenityServiceCharts() {
  return <section aria-label="Gráficos das massagens" className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Distribution title="Atendimentos por Tipo" subtitle="Acumulado até setembro" items={serenityServices.map((s) => ({ label: s.label, value: Number(s.total) }))} />
      <Distribution title="Receita por Tipo" subtitle="R$ acumulado" format="currency" items={serenityServices.map((s) => ({ label: s.label, value: s.revenue }))} />
    </div>
    <Trend title="Evolução de Atendimentos" subtitle="Atendimentos por serviço, mês a mês"
      points={servicePoints} kind="line" lines={serenityServices.map((s, i) => series(s.label, s.label, "integer", i))}
      note="Ausência de registro não significa zero; as lacunas permanecem vazias." height={300} />
  </section>;
}

const topTherapists = [...serenityTherapists].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
const therapistPoints = serenityMonths.map((m, i) => ({
  key: m.short, label: m.short, fullLabel: m.label,
  values: Object.fromEntries(topTherapists.map((t) => [t.label, t.counts[i]])),
})) satisfies SeriesPoint[];

export function SerenityTherapistCharts() {
  return <section aria-label="Gráficos de terapeutas" className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Distribution title="Atendimentos por Terapeuta" subtitle="Acumulado" format="integer" kind="bars" height={510}
        items={[...serenityTherapists].sort((a, b) => Number.parseInt(b.total) - Number.parseInt(a.total)).map((t) => ({ label: t.label, value: Number.parseInt(t.total) || 0 }))} />
      <Distribution title="Receita por Terapeuta" subtitle="R$ acumulado" format="currency" kind="bars" height={510}
        items={[...serenityTherapists].sort((a, b) => b.revenue - a.revenue).map((t) => ({ label: t.label, value: t.revenue }))} />
    </div>
    <Trend title="Evolução de Atendimentos" subtitle="Principais terapeutas por receita · por mês" points={therapistPoints} kind="line"
      lines={topTherapists.map((t, i) => series(t.label, t.label, "integer", i))}
      note="A evolução destaca os seis maiores faturamentos para facilitar a leitura; o ranking completo permanece na tabela." height={300} />
  </section>;
}

const isaborPoints = isaborMonths.map((m) => ({
  key: m.short, label: m.short, fullLabel: m.label,
  values: {
    revenue: m.revenue, spend: m.spend,
    leads: m.leads, bookings: m.bookings, attended: m.attended,
    totalRoas: m.revenue / m.spend,
    googleRoas: m.googleRevenue / m.googleSpend,
    metaRoas: m.metaRevenue / m.metaSpend,
  },
})) satisfies SeriesPoint[];

export function IsaborFocusCharts() {
  return <section aria-label="Gráficos de setembro da Dra. Isabor" className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Distribution title="Taxas de Conversão — Setembro" subtitle="Eficiência por etapa do funil" kind="bars" format="percent"
        items={[{ label: "Lead → agendamento", value: 23 / 130 }, { label: "Agend. → comparec.", value: 18 / 23 }, { label: "Lead → paciente", value: 18 / 130 }]} />
      <Distribution title="Investimento em Mídia" subtitle="Distribuição entre os canais pagos" format="currency"
        items={[{ label: "Meta Ads", value: isaborMonths[4].metaSpend }, { label: "Google Ads", value: isaborMonths[4].googleSpend }]} />
      <Distribution title="Receita por Canal" subtitle="Setembro · R$ 7.750" format="currency"
        items={[{ label: "Indicação", value: 3750 }, { label: "Instagram", value: 3550 }, { label: "Google", value: 450 }]} />
      <Distribution title="Leads por Canal" subtitle="Setembro · 130 leads" items={[{ label: "Instagram", value: 89 }, { label: "Google", value: 26 }, { label: "Indicação", value: 15 }]} />
    </div>
  </section>;
}

export function IsaborComparisonCharts() {
  return <section aria-label="Tendência dos principais indicadores da Dra. Isabor" className="space-y-4">
    <h2 className="text-lg font-bold text-text">Tendência dos principais indicadores</h2>
    <div className="grid gap-4 lg:grid-cols-2">
      <Trend title="Receita e Investimento" subtitle="Evolução mensal em R$" points={isaborPoints}
        lines={[series("revenue", "Receita", "currency"), series("spend", "Investimento", "currency", 1)]} />
      <Trend title="Funil — Volumes" subtitle="Leads, agendamentos e comparecimentos"
        points={isaborPoints} lines={[series("leads", "Leads", "integer"), series("bookings", "Agendamentos", "integer", 1), series("attended", "Comparecimentos", "integer", 2)]} />
    </div>
  </section>;
}

export function IsaborRoiChart() {
  return <section aria-label="Evolução do retorno mensal" className="space-y-4">
    <h2 className="text-lg font-bold text-text">Evolução do retorno mês a mês</h2>
    <Trend title="ROI Geral · Google Ads · Instagram" subtitle="ROAS (x) — comparativo de performance por canal"
      points={isaborPoints} kind="line"
      lines={[series("totalRoas", "Geral", "multiplier"), series("googleRoas", "Google Ads", "multiplier", 1), series("metaRoas", "Instagram", "multiplier", 2)]}
      note="O retorno geral usa receita total; os retornos dos canais usam somente a receita atribuída a cada um." height={310} />
  </section>;
}
