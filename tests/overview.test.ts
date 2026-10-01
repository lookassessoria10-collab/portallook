import { describe, expect, it } from "vitest";
import { buildTrafficView, trafficSummary } from "@/features/traffic/metrics";
import { TrafficDataSchema, type TrafficDataInput } from "@/features/traffic/schema";
import { buildTrafficOverview } from "@/features/traffic/overview";
import { commercialSummary, computeCommercialMetrics } from "@/features/commercial/metrics";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { buildCommercialOverview } from "@/features/commercial/overview";
import { DashboardConfigSchema } from "@/features/clients/schema";
import type { ReportIndexEntry } from "@/features/reports/schema";
import { formatPeriodRange, monthPeriod, periodKey, periodSeriesLabels, type Period } from "@/lib/dates/period";

function entry(type: "traffic" | "commercial", period: Period, summary: ReportIndexEntry["summary"], labels: ReportIndexEntry["labels"]): ReportIndexEntry {
  const now = "2026-09-01T12:00:00.000Z";
  return {
    id: `rp_${type}_${periodKey(period)}`,
    type,
    kind: "dataset",
    period,
    periodKey: periodKey(period),
    title: null,
    status: "published",
    summary,
    labels,
    allowDownload: false,
    updatedAt: now,
    publishedAt: now,
    createdAt: now,
    sourceType: "xlsx",
    sourceFileName: null,
    insightCount: 0,
  };
}

type Campaigns = TrafficDataInput["campaigns"];
const traffic = (month: number, campaigns: Campaigns) => TrafficDataSchema.parse({ schemaVersion: 1, period: monthPeriod(2026, month), campaigns });
const trafficEntry = (month: number, campaigns: Campaigns) => {
  const { summary, labels } = trafficSummary(traffic(month, campaigns));
  return entry("traffic", monthPeriod(2026, month), summary, labels);
};

const jan: Campaigns = [
  { id: "m1", platform: "meta_ads", name: "WhatsApp", investment: 397.88, impressions: 30000, clicks: 600, results: 12, resultType: "whatsapp" },
  { id: "g1", platform: "google_ads", name: "Pesquisa", investment: 859.43, impressions: 9000, clicks: 450, results: 37, resultType: "whatsapp" },
];
const fev: Campaigns = [
  { id: "m1", platform: "meta_ads", name: "WhatsApp", investment: 602.86, impressions: 41000, clicks: 820, results: 54, resultType: "whatsapp" },
  { id: "m2", platform: "meta_ads", name: "Alcance", investment: 100, impressions: 52000, clicks: null, results: null },
  { id: "g1", platform: "google_ads", name: "Pesquisa", investment: 1216.22, impressions: 11000, clicks: 500, results: 46, resultType: "whatsapp" },
];
const jun: Campaigns = [{ id: "g1", platform: "google_ads", name: "Pesquisa", investment: 291.29, impressions: 5000, clicks: 200, results: 22, resultType: "whatsapp" }];

describe("visão geral de tráfego", () => {
  const vm = buildTrafficOverview([trafficEntry(1, jan), trafficEntry(2, fev), trafficEntry(6, jun)]);
  // Os totais da visão geral precisam bater com um relatório único contendo todas as campanhas.
  const merged = buildTrafficView(traffic(1, [...jan, ...fev.map((c) => ({ ...c, id: `${c.id}-fev` })), ...jun.map((c) => ({ ...c, id: `${c.id}-jun` }))])).totals;
  const kpi = (key: string) => [...vm.kpis, ...vm.secondary].find((k) => k.key === key)?.value;

  it("soma investimento e resultados e recalcula as taxas sobre as somas", () => {
    expect(kpi("investment")).toBeCloseTo(merged.investment, 6);
    expect(kpi("results")).toBe(merged.results);
    expect(kpi("costPerResult")).toBeCloseTo(merged.costPerResult!, 6);
    expect(kpi("ctr")).toBeCloseTo(merged.ctr!, 9);
    expect(kpi("cpc")).toBeCloseTo(merged.cpc!, 6);
    expect(kpi("cpm")).toBeCloseTo(merged.cpm!, 6);
  });

  it("usa o tipo de resultado quando é um só e separa por plataforma com cor fixa", () => {
    expect(vm.resultsLabel).toBe("Conversas no WhatsApp");
    expect(vm.platforms.map((p) => [p.key, p.color])).toEqual([
      ["meta_ads", "var(--chart-1)"],
      ["google_ads", "var(--chart-2)"],
    ]);
    expect(vm.investmentSeries.map((s) => s.key)).toEqual(["platform.meta_ads.investment", "platform.google_ads.investment"]);
  });

  it("monta a tabela mês a mês com grupos por plataforma e total", () => {
    expect(vm.table.groups.map((g) => g.label)).toEqual(["Meta Ads", "Google Ads", "Total"]);
    expect(vm.table.rows.map((r) => r.label)).toEqual(["Janeiro", "Fevereiro", "Junho"]);
    // Junho só teve Google: Meta fica vazio ("—"), não zero.
    expect(vm.table.rows[2].values["platform.meta_ads.investment"] ?? null).toBeNull();
    expect(vm.table.rows[0].values["platform.google_ads.costPerResult"]).toBeCloseTo(859.43 / 37, 6);
    expect(vm.table.total?.["platform.meta_ads.results"]).toBe(66);
    expect(vm.headline).toMatch(/^Janeiro a junho de 2026: R\$\s3\.468 investidos e 171 conversas no WhatsApp\.$/);
  });

  it("com uma plataforma só, a tabela traz impressões, cliques e CTR", () => {
    const single = buildTrafficOverview([trafficEntry(1, [jan[0]]), trafficEntry(2, [fev[0]])]);
    expect(single.table.groups).toHaveLength(1);
    expect(single.table.groups[0].columns.map((c) => c.key)).toEqual(["investment", "results", "costPerResult", "impressions", "clicks", "ctr"]);
    expect(single.investmentSeries).toEqual([{ key: "platform.meta_ads.investment", label: "Meta Ads", format: "currency", color: "var(--chart-1)" }]);
  });
});

describe("visão geral comercial", () => {
  const months = [
    { m: 6, leads: 200, conv: 10, revenue: 5000, investment: 1000, channels: [{ key: "instagram", label: "Instagram", kind: "paid", leads: 150 }, { key: "google", label: "Google", kind: "paid", leads: 50 }] },
    { m: 7, leads: 300, conv: 30, revenue: 9000, investment: 1500, channels: [{ key: "instagram", label: "Instagram", kind: "paid", leads: 200 }, { key: "google", label: "Google", kind: "paid", leads: 100 }] },
  ];
  const datas = months.map(({ m, leads, conv, revenue, investment, channels }) =>
    CommercialDataSchema.parse({
      schemaVersion: 1,
      period: monthPeriod(2026, m),
      funnel: [
        { key: "leads", label: "Leads", order: 1, value: leads },
        { key: "consultas", label: "Consultas", order: 2, value: conv },
      ],
      financial: { revenue, mediaInvestment: investment },
      channels,
    }),
  );
  const entries = datas.map((d) => {
    const { summary, labels } = commercialSummary(d);
    return entry("commercial", d.period, summary, labels);
  });
  const vm = buildCommercialOverview(entries, { dashboard: DashboardConfigSchema.parse({}) });
  const kpi = (key: string) => [...vm.kpis, ...vm.secondary].find((k) => k.key === key);

  it("recalcula conversão, CPL, ROAS e ticket sobre as somas", () => {
    expect(kpi("leads")?.value).toBe(500);
    expect(kpi("leads")?.label).toBe("Leads");
    expect(kpi("conversions")?.label).toBe("Consultas");
    expect(kpi("conversionRate")?.value).toBeCloseTo(40 / 500, 9);
    expect(kpi("cpl")?.value).toBeCloseTo(2500 / 500, 9);
    expect(kpi("roas")?.value).toBeCloseTo(14000 / 2500, 9);
    expect(kpi("averageTicket")?.value).toBeCloseTo(14000 / 40, 9);
    // Mesma regra do relatório de um período.
    expect(computeCommercialMetrics(datas[0]).roas).toBeCloseTo(5, 9);
  });

  it("empilha os canais e monta a tabela período a período", () => {
    expect(vm.channelSeries?.map((s) => s.label)).toEqual(["Instagram", "Google"]);
    expect(vm.table.rows.map((r) => r.label)).toEqual(["Junho", "Julho"]);
    expect(vm.table.total?.conversionRate).toBeCloseTo(0.08, 9);
    expect(vm.headline).toMatch(/^Junho a julho de 2026: 500 leads e 40 consultas, com receita de R\$\s14\.000\.$/);
  });
});

describe("rótulos de séries de períodos", () => {
  it("só mostra o ano quando a série cruza anos", () => {
    expect(periodSeriesLabels([monthPeriod(2026, 1), monthPeriod(2026, 8)]).map((l) => [l.axis, l.row])).toEqual([
      ["Jan", "Janeiro"],
      ["Ago", "Agosto"],
    ]);
    expect(periodSeriesLabels([monthPeriod(2025, 12), monthPeriod(2026, 1)]).map((l) => l.axis)).toEqual(["Dez/25", "Jan/26"]);
  });
  it("descreve o intervalo coberto", () => {
    expect(formatPeriodRange(monthPeriod(2026, 1), monthPeriod(2026, 8))).toBe("Janeiro a agosto de 2026");
    expect(formatPeriodRange(monthPeriod(2025, 9), monthPeriod(2026, 8))).toBe("Setembro de 2025 a agosto de 2026");
  });
});
