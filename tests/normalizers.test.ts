import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readExcel } from "@/lib/parsers/xlsx";
import { readCsv } from "@/lib/parsers/csv";
import { monthPeriod, weekPeriod } from "@/lib/dates/period";
import { normalizeCommercial } from "@/features/commercial/normalize";
import { normalizeTraffic } from "@/features/traffic/normalize";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { TrafficDataSchema } from "@/features/traffic/schema";
import { IssueCollector } from "@/features/uploads/issues";
import { commercialTemplateWorkbook, CSV_FUNNEL_EXAMPLE, CSV_TRAFFIC_EXAMPLE, trafficTemplateWorkbook, workbookBuffer } from "@/features/uploads/templates";
import { buildTrafficView } from "@/features/traffic/metrics";

const monthCtx = { granularity: "month" as const, requestedPeriod: null };
const weekCtx = { granularity: "week" as const, requestedPeriod: null };

function book(sheets: Record<string, Array<Array<string | number | null>>>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return readExcel(workbookBuffer(wb), "xlsx");
}

describe("normalização comercial", () => {
  it("modelo oficial vira dados padronizados por período", () => {
    const issues = new IssueCollector();
    const result = normalizeCommercial(readExcel(workbookBuffer(commercialTemplateWorkbook()), "xlsx"), monthCtx, issues);
    expect(issues.errors).toEqual([]);
    expect(result.periods.map((p) => p.periodKey)).toEqual(["2026-08", "2026-09"]);
    const sep = CommercialDataSchema.parse(result.periods[1].data);
    expect(sep.funnel.map((s) => s.label)).toEqual(["Leads", "Agendamentos", "Comparecimentos"]);
    expect(sep.financial?.revenue).toBe(4675);
    expect(sep.channels.find((c) => c.key === "indicacao")?.kind).toBe("referral");
    expect(sep.channels.find((c) => c.key === "doctoralia")?.kind).toBe("marketplace");
    expect(sep.dimensions[0].label).toBe("Serviços");
    expect(sep.dimensions[0].quantityLabel).toBe("Atendimentos");
    expect(sep.extraMetrics[0].direction).toBe("higherIsBetter");
    expect(result.periods[1].insights).toHaveLength(2);
    expect(result.periods[1].insights[1].type).toBe("recommendation");
    expect(result.sheets.find((s) => s.name === "Instruções")?.recognizedAs).toBeNull();
  });

  it("funil em formato longo, com etapas não registradas (CSV)", () => {
    const issues = new IssueCollector();
    const result = normalizeCommercial(readCsv(Buffer.from(CSV_FUNNEL_EXAMPLE), "Funil"), { ...monthCtx, csvRole: "funnel" }, issues);
    expect(issues.errors).toEqual([]);
    const data = result.periods[0].data as { funnel: Array<{ label: string; value: number | null; order: number }> };
    expect(data.funnel.map((s) => [s.label, s.value])).toEqual([
      ["Leads", 52],
      ["Em contato", null],
      ["Propostas enviadas", null],
      ["Vendas", 5],
    ]);
  });

  it("funis diferentes por cliente (2 e 4 etapas) sem código específico", () => {
    const two = normalizeCommercial(book({ Funil: [["Mês", "Leads", "Conversões"], ["07/2026", 39, 9]] }), monthCtx, new IssueCollector());
    expect((two.periods[0].data as { funnel: unknown[] }).funnel).toHaveLength(2);
    const four = normalizeCommercial(book({ Funil: [["Período", "Leads", "Em contato", "Propostas", "Vendas"], ["07/2026", 53, 11, 5, 4]] }), monthCtx, new IssueCollector());
    expect((four.periods[0].data as { funnel: unknown[] }).funnel).toHaveLength(4);
  });

  it("erros humanos: aba Funil ausente, período inválido, número inválido", () => {
    const noFunnel = new IssueCollector();
    normalizeCommercial(book({ Financeiro: [["Período", "Receita"], ["09/2026", 100]] }), monthCtx, noFunnel);
    expect(noFunnel.errors[0].message).toMatch(/aba "Funil" não foi encontrada/);

    const badPeriod = new IssueCollector();
    normalizeCommercial(book({ Funil: [["Período", "Leads"], ["setembrro/2026", 10]] }), monthCtx, badPeriod);
    expect(badPeriod.errors[0].message).toMatch(/período "setembrro\/2026".*não é válido/);

    const badNumber = new IssueCollector();
    normalizeCommercial(book({ Funil: [["Período", "Leads"], ["09/2026", "muitos"]] }), monthCtx, badNumber);
    expect(badNumber.errors[0].message).toMatch(/não é um número/);
    for (const i of [...noFunnel.items, ...badPeriod.items, ...badNumber.items]) expect(i.message).not.toMatch(/undefined|NaN|exception/i);
  });

  it("avisos: receita ausente e soma dos canais diferente do funil", () => {
    const issues = new IssueCollector();
    normalizeCommercial(
      book({
        Funil: [["Período", "Leads", "Vendas"], ["09/2026", 100, 10]],
        Canais: [["Período", "Canal", "Leads"], ["09/2026", "Google Ads", 60], ["09/2026", "Meta Ads", 20]],
      }),
      monthCtx,
      issues,
    );
    expect(issues.hasErrors).toBe(false);
    const codes = issues.warnings.map((w) => w.code);
    expect(codes).toContain("missing_revenue");
    expect(codes).toContain("channel_sum_mismatch");
    expect(codes).toContain("channel_no_conversion");
  });

  it("sem coluna de período usa o período escolhido no assistente", () => {
    const issues = new IssueCollector();
    const r = normalizeCommercial(book({ Funil: [["Leads", "Vendas"], [100, 10]] }), { granularity: "month", requestedPeriod: monthPeriod(2026, 9) }, issues);
    expect(issues.errors).toEqual([]);
    expect(r.periods[0].periodKey).toBe("2026-09");
  });
});

describe("normalização de tráfego", () => {
  it("modelo oficial: Meta e Google na mesma semana", () => {
    const issues = new IssueCollector();
    const result = normalizeTraffic(readExcel(workbookBuffer(trafficTemplateWorkbook()), "xlsx"), { ...weekCtx, clientNames: ["Dra. Isabor Sant'Anna", "isabor"] }, issues);
    expect(issues.errors).toEqual([]);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].period).toEqual(weekPeriod("2026-09-21"));
    const data = TrafficDataSchema.parse(result.periods[0].data);
    expect(data.campaigns.map((c) => c.platform).sort()).toEqual(["google_ads", "meta_ads"]);
    const meta = data.campaigns.find((c) => c.platform === "meta_ads")!;
    expect(meta.linkClicks).toBe(75);
    expect(meta.resultType).toBe("whatsapp");
    expect(result.periods[0].insights).toHaveLength(1);
  });

  it("CSV da IL Distribuidora: 104 conversas no WhatsApp", () => {
    const issues = new IssueCollector();
    const result = normalizeTraffic(readCsv(Buffer.from(CSV_TRAFFIC_EXAMPLE), "Campanhas"), { ...weekCtx, clientNames: ["IL Distribuidora"], csv: true }, issues);
    expect(issues.errors).toEqual([]);
    const view = buildTrafficView(TrafficDataSchema.parse(result.periods[0].data));
    expect(view.totals.results).toBe(104);
    expect(view.totals.impressions).toBe(6220 + 3361 + 26457);
  });

  it("cliente incompatível e colunas obrigatórias ausentes são erros", () => {
    const wrong = new IssueCollector();
    normalizeTraffic(
      book({ Campanhas: [["Cliente", "Início", "Fim", "Plataforma", "Campanha", "Investimento", "Impressões"], ["Outra Empresa", "21/09/2026", "27/09/2026", "Meta", "X", 10, 100]] }),
      { ...weekCtx, clientNames: ["IL Distribuidora"] },
      wrong,
    );
    expect(wrong.errors[0].code).toBe("client_mismatch");

    const missing = new IssueCollector();
    normalizeTraffic(book({ Campanhas: [["Campanha", "Plataforma"], ["X", "Meta"]] }), { ...weekCtx, clientNames: [] }, missing);
    expect(missing.errors.map((e) => e.message).join(" ")).toMatch(/Investimento/);
  });

  it("período que não começa na segunda vira intervalo personalizado", () => {
    const issues = new IssueCollector();
    const r = normalizeTraffic(
      book({ Campanhas: [["Início", "Fim", "Plataforma", "Campanha", "Investimento", "Impressões"], ["20/09/2026", "26/09/2026", "Google Ads", "X", 10, 100]] }),
      { ...weekCtx, clientNames: [] },
      issues,
    );
    expect(r.periods[0].period.granularity).toBe("custom");
  });
});
