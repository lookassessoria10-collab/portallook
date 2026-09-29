import { describe, expect, it } from "vitest";
import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";
import { compareValues, formatComparisonDelta } from "@/lib/metrics/comparison";
import { computeChannelMetrics, computeCommercialMetrics, commercialSummary } from "@/features/commercial/metrics";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { buildTrafficView } from "@/features/traffic/metrics";
import { TrafficDataSchema } from "@/features/traffic/schema";
import { monthPeriod, weekPeriod } from "@/lib/dates/period";

const isabor = CommercialDataSchema.parse({
  schemaVersion: 1,
  period: monthPeriod(2026, 8),
  funnel: [
    { key: "leads", label: "Leads", order: 1, value: 257 },
    { key: "agendamentos", label: "Agendamentos", order: 2, value: 14 },
    { key: "comparecimentos", label: "Comparecimentos", order: 3, value: 8 },
  ],
  financial: { revenue: 3400, mediaInvestment: 1208.17 },
  channels: [
    { key: "instagram", label: "Instagram", kind: "paid", leads: 217, conversions: 1, revenue: 450, investment: 680.4 },
    { key: "google", label: "Google Ads", kind: "paid", leads: 26, conversions: 0, revenue: 0, investment: 527.77 },
    { key: "indicacao", label: "Indicação", kind: "referral", leads: 4, conversions: 3, revenue: 1310 },
  ],
});

describe("matemática segura", () => {
  it("divisão por zero ou ausente devolve null", () => {
    expect(safeDivide(10, 0)).toBeNull();
    expect(safeDivide(10, null)).toBeNull();
    expect(safeDivide(null, 5)).toBeNull();
    expect(safeDivide(Infinity, 5)).toBeNull();
    expect(safeDivide(10, 4)).toBe(2.5);
  });
  it("soma ignora ausentes", () => {
    expect(sumMaybe([null, undefined])).toBeNull();
    expect(sumMaybe([1, null, 2])).toBe(3);
  });
});

describe("métricas comerciais", () => {
  const m = computeCommercialMetrics(isabor);

  it("calcula taxas do funil dinâmico", () => {
    expect(m.leads).toBe(257);
    expect(m.conversions).toBe(8);
    expect(m.finalStageLabel).toBe("Comparecimentos");
    expect(m.conversionRate).toBeCloseTo(8 / 257);
    expect(m.stages[1].rateFromPrevious).toBeCloseTo(14 / 257);
    expect(m.stages[2].rateFromPrevious).toBeCloseTo(8 / 14);
  });

  it("calcula ticket, CPL, CPA, ROAS e ROI%", () => {
    expect(m.averageTicket).toBe(425);
    expect(m.cpl).toBeCloseTo(1208.17 / 257);
    expect(m.cpa).toBeCloseTo(1208.17 / 8);
    expect(m.roas).toBeCloseTo(3400 / 1208.17);
    expect(m.roasBasis).toBe("total");
    expect(m.roiPercent).toBeCloseTo((3400 - 1208.17) / 1208.17);
  });

  it("usa receita atribuída quando informada", () => {
    const data = CommercialDataSchema.parse({ ...isabor, financial: { revenue: 3400, mediaInvestment: 1000, attributedRevenue: 2000 } });
    const r = computeCommercialMetrics(data);
    expect(r.roas).toBe(2);
    expect(r.roasBasis).toBe("attributed");
  });

  it("etapa não registrada (null) não vira zero nem quebra as taxas", () => {
    const larplan = CommercialDataSchema.parse({
      schemaVersion: 1,
      period: monthPeriod(2026, 8),
      funnel: [
        { key: "leads", label: "Leads", order: 1, value: 52 },
        { key: "contato", label: "Em contato", order: 2, value: null },
        { key: "vendas", label: "Vendas", order: 3, value: 5 },
      ],
      financial: { revenue: 139560.89, mediaInvestment: 1681.82, sales: 5 },
    });
    const r = computeCommercialMetrics(larplan);
    expect(r.stages[1].value).toBeNull();
    expect(r.stages[2].rateFromPrevious).toBeNull();
    expect(r.stages[2].rateFromFirst).toBeCloseTo(5 / 52);
    expect(r.averageTicket).toBeCloseTo(139560.89 / 5);
  });

  it("sem investimento, ROAS e CPL ficam indisponíveis (sem NaN)", () => {
    const data = CommercialDataSchema.parse({ ...isabor, financial: { revenue: 3400 }, channels: [] });
    const r = computeCommercialMetrics(data);
    expect(r.investment).toBeNull();
    expect(r.roas).toBeNull();
    expect(r.cpl).toBeNull();
    expect(r.roiPercent).toBeNull();
  });

  it("métricas por canal e participação", () => {
    const ch = computeChannelMetrics(isabor.channels);
    expect(ch[0].key).toBe("instagram");
    expect(ch[0].cpl).toBeCloseTo(680.4 / 217);
    expect(ch[1].roas).toBe(0);
    expect(ch.find((c) => c.key === "indicacao")?.roas).toBeNull();
    expect(ch.find((c) => c.key === "indicacao")?.conversionRate).toBe(0.75);
  });

  it("resumo do índice guarda etapas e rótulos", () => {
    const { summary, labels } = commercialSummary(isabor);
    expect(summary["stage.agendamentos"]).toBe(14);
    expect(labels.finalStage).toBe("Comparecimentos");
  });
});

describe("comparação entre períodos", () => {
  it("custo menor é positivo (lowerIsBetter)", () => {
    const c = compareValues(4.7, 5.07, { direction: "lowerIsBetter" });
    expect(c.trend).toBe("down");
    expect(c.sentiment).toBe("positive");
  });
  it("receita menor é negativa (higherIsBetter)", () => {
    const c = compareValues(8420, 8780, { direction: "higherIsBetter" });
    expect(c.sentiment).toBe("negative");
    expect(formatComparisonDelta(c)).toBe("−4,1%");
  });
  it("taxas comparam em pontos percentuais", () => {
    const c = compareValues(0.031, 0.026, { direction: "higherIsBetter", kind: "points" });
    expect(formatComparisonDelta(c)).toBe("+0,5 p.p.");
  });
  it("anterior zero = novo; ambos zero = estável; ausente = indisponível", () => {
    expect(compareValues(5, 0, { direction: "higherIsBetter" }).status).toBe("new");
    expect(compareValues(0, 0, { direction: "higherIsBetter" }).status).toBe("stable");
    expect(compareValues(5, null, { direction: "higherIsBetter" }).status).toBe("unavailable");
  });
  it("investimento é neutro", () => {
    expect(compareValues(1300, 1000, { direction: "neutral" }).sentiment).toBe("neutral");
  });
});

describe("métricas de tráfego", () => {
  const il = TrafficDataSchema.parse({
    schemaVersion: 1,
    period: weekPeriod("2026-09-21"),
    campaigns: [
      { id: "a", platform: "meta_ads", name: "SETEMBRO-26 | Itens em promoção", investment: 174.91, impressions: 6220, reach: 4343, results: 37, resultType: "whatsapp" },
      { id: "b", platform: "meta_ads", name: "Lauro de Freitas - campanha", investment: 132.66, impressions: 3361, reach: 2065, results: 16, resultType: "whatsapp" },
      { id: "c", platform: "meta_ads", name: "Cidades com Unidade IL", investment: 193.42, impressions: 26457, reach: 25087, results: 51, resultType: "whatsapp" },
    ],
  });

  it("custo por resultado de cada campanha (valores do exemplo real)", () => {
    const v = buildTrafficView(il);
    const byId = Object.fromEntries(v.campaigns.map((c) => [c.id, c]));
    expect(byId.a.costPerResult).toBeCloseTo(4.73, 2);
    expect(byId.b.costPerResult).toBeCloseTo(8.29, 2);
    expect(byId.c.costPerResult).toBeCloseTo(3.79, 2);
    expect(v.totals.results).toBe(104);
    expect(v.totals.resultGroups).toHaveLength(1);
    expect(v.totals.resultGroups[0].label).toBe("Conversas no WhatsApp");
  });

  it("CTR do Google Ads (216 / 6.513 = 3,32%) e CPM", () => {
    const g = TrafficDataSchema.parse({
      schemaVersion: 1,
      period: weekPeriod("2026-09-21"),
      campaigns: [{ id: "g", platform: "google_ads", name: "Pesquisa", investment: 175.82, impressions: 6513, clicks: 216 }],
    });
    const c = buildTrafficView(g).campaigns[0];
    expect(c.ctr).toBeCloseTo(0.0332, 4);
    expect(c.cpc).toBeCloseTo(175.82 / 216);
    expect(c.cpm).toBeCloseTo((175.82 / 6513) * 1000);
    expect(c.costPerResult).toBeNull();
  });

  it("não soma tipos de resultado diferentes como se fossem iguais", () => {
    const mixed = TrafficDataSchema.parse({
      schemaVersion: 1,
      period: weekPeriod("2026-09-21"),
      campaigns: [
        { id: "m", platform: "meta_ads", name: "WhatsApp", investment: 100, impressions: 1000, results: 20, resultType: "whatsapp" },
        { id: "g", platform: "google_ads", name: "Leads", investment: 100, impressions: 1000, results: 5, resultType: "lead" },
      ],
    });
    const v = buildTrafficView(mixed);
    expect(v.totals.resultGroups.map((g) => g.type)).toEqual(["whatsapp", "lead"]);
    expect(v.totals.resultGroups[1].costPerResult).toBe(20);
    expect(v.platforms.map((p) => p.platform)).toEqual(["meta_ads", "google_ads"]);
  });

  it("usa cliques no link quando não há cliques gerais", () => {
    const meta = TrafficDataSchema.parse({
      schemaVersion: 1,
      period: weekPeriod("2026-09-21"),
      campaigns: [{ id: "m", platform: "meta_ads", name: "Novo site", investment: 144.68, impressions: 5755, reach: 3860, linkClicks: 75 }],
    });
    const c = buildTrafficView(meta).campaigns[0];
    expect(c.clicksSource).toBe("linkClicks");
    expect(c.ctr).toBeCloseTo(75 / 5755);
    expect(c.frequency).toBeCloseTo(5755 / 3860);
  });
});
