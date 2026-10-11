import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { readExcel } from "@/lib/parsers/xlsx";
import { readPastedData } from "@/lib/parsers/markdown";
import { monthPeriod } from "@/lib/dates/period";
import { IssueCollector } from "@/features/uploads/issues";
import { workbookBuffer } from "@/features/uploads/templates";
import { normalizeCommercial } from "@/features/commercial/normalize";
import { CommercialDataSchema, type CommercialData } from "@/features/commercial/schema";
import { commercialSummary } from "@/features/commercial/metrics";
import { buildCommercialViewModel } from "@/features/commercial/view-model";
import { buildCommercialOverview } from "@/features/commercial/overview";
import type { ReportIndexEntry } from "@/features/reports/schema";

type Row = Array<string | number | null>;
const monthCtx = { granularity: "month" as const, requestedPeriod: null };
const dashboard = { roiMetric: "roas" as const, highlightMetrics: [] };

function read(sheets: Record<string, Row[]>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  const issues = new IssueCollector();
  const result = normalizeCommercial(readExcel(workbookBuffer(wb), "xlsx"), monthCtx, issues);
  return { ...result, issues, data: (i: number) => CommercialDataSchema.parse(result.periods[i].data) };
}

const entry = (d: CommercialData): ReportIndexEntry => {
  const { summary, labels } = commercialSummary(d);
  return { id: `rp_${d.period.start}`, type: "commercial", kind: "dataset", period: d.period, periodKey: d.period.start.slice(0, 7), title: null, status: "published", summary, labels, allowDownload: false, retroactive: false, updatedAt: "2026-10-01T00:00:00.000Z", publishedAt: "2026-10-01T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z", sourceType: "xlsx", sourceFileName: null, insightCount: 0 };
};

/** Formato da Serenity: novos × recorrentes, canais pagos, massagens e terapeutas com status. */
const SERENITY: Record<string, Row[]> = {
  Funil: [
    ["Mês", "Leads", "Agendamentos", "Comparecimentos"],
    ["07/2026", 170, 47, 41],
    ["08/2026", 172, 43, 37],
  ],
  Financeiro: [
    ["Mês", "Receita", "Investimento em mídia", "Receita atribuída"],
    ["07/2026", 12445, 589.49, 3095],
    ["08/2026", 12710, 591.56, 4450],
  ],
  Clientes: [
    ["Mês", "Novos clientes", "Clientes recorrentes"],
    ["07/2026", 28, 13],
    ["08/2026", 22, 15],
  ],
  Canais: [
    ["Mês", "Canal", "Tipo", "Leads", "Receita", "Investimento"],
    ["07/2026", "ADS (Meta)", "Mídia paga", 95, 2045, 369.49],
    ["07/2026", "Sites de Massagem", "Mídia paga", 20, 1050, 220],
    ["07/2026", "Cliente Recorrente", "Recorrente", 14, 4840, null],
    ["08/2026", "ADS (Meta)", "Mídia paga", 95, 2150, 371.56],
    ["08/2026", "Sites de Massagem", "Mídia paga", 25, 2300, 220],
    ["08/2026", "Cliente Recorrente", "Recorrente", 17, 5750, null],
  ],
  Terapeutas: [
    ["Mês", "Terapeuta", "Atendimentos", "Receita", "Status"],
    ["07/2026", "Marina", 19, 6800, null],
    ["07/2026", "Larissa", 10, 1890, null],
    ["08/2026", "Marina", 13, 4400, "Destaque Ago"],
    ["08/2026", "Bruna", 15, 5060, "Destaque Ago"],
    ["08/2026", "Larissa", null, null, "Inativa Ago"],
  ],
  "Plano de ação": [
    ["Mês", "Prioridade", "Ação"],
    ["08/2026", "1 · Conversão", "Recuperar a conversão Lead → Agendamento para ≥ 27%"],
    ["08/2026", "2 · Sites", "Escalar o investimento nos Sites de Massagem"],
  ],
};

describe("comercial flexível: leitura", () => {
  it("novos × recorrentes, terapeutas com status e plano de ação no mesmo modelo", () => {
    const r = read(SERENITY);
    expect(r.issues.errors).toEqual([]);
    expect(r.sheets.map((s) => s.recognizedAs)).toEqual(["Funil", "Financeiro", "Clientes (novos × recorrentes)", "Canais", "Detalhamento: Terapeutas", "Tabela: Plano de ação"]);
    const aug = r.data(1);
    expect(aug.customers).toEqual({ new: 22, returning: 15 });
    expect(aug.tables).toEqual([{ key: "plano-de-acao", title: "Plano de ação", columns: ["Prioridade", "Ação"], rows: [["1 · Conversão", "Recuperar a conversão Lead → Agendamento para ≥ 27%"], ["2 · Sites", "Escalar o investimento nos Sites de Massagem"]] }]);
    const therapists = aug.dimensions.find((d) => d.label === "Terapeutas")!;
    expect(therapists.quantityLabel).toBe("Atendimentos");
    expect(therapists.rows.map((x) => [x.label, x.quantity, x.note])).toEqual([
      ["Marina", 13, "Destaque Ago"],
      ["Bruna", 15, "Destaque Ago"],
      ["Larissa", null, "Inativa Ago"],
    ]);
    // Sem coluna de conversões por canal é escolha do cliente: não vira aviso repetido.
    expect(r.issues.warnings.map((w) => w.code)).not.toContain("channel_no_conversion");
  });

  it("aba sem números vira tabela livre; tabela colada também", () => {
    const r = read({ Funil: [["Mês", "Leads", "Comparecimentos"], ["09/2026", 130, 18]], "Próximos passos": [["Mês", "Ação", "Responsável"], ["09/2026", "Ligar para os leads parados", "Recepção"]] });
    expect(r.issues.errors).toEqual([]);
    expect(r.sheets[1].recognizedAs).toBe("Tabela: Próximos passos");
    expect(r.data(0).tables[0]).toMatchObject({ title: "Próximos passos", columns: ["Ação", "Responsável"], rows: [["Ligar para os leads parados", "Recepção"]] });

    const pasted = ["## Funil", "| Mês | Leads | Comparecimentos |", "| 09/2026 | 130 | 18 |", "", "## Oportunidades", "| Mês | Origem | Data agendada | Situação |", "| 09/2026 | Indicação | 02/10/2026 | Aguardando atendimento |"].join("\n");
    const issues = new IssueCollector();
    const out = normalizeCommercial(readPastedData(Buffer.from(pasted), "Funil"), monthCtx, issues);
    expect(issues.errors).toEqual([]);
    expect(CommercialDataSchema.parse(out.periods[0].data).tables[0].rows).toEqual([["Indicação", "02/10/2026", "Aguardando atendimento"]]);
  });

  it("aproveita o que já veio em Indicadores: novos/recorrentes vão para o lugar certo, ROI em “x” e aviso dos calculados", () => {
    const r = read({
      Funil: [["Mês", "Leads", "Comparecimentos"], ["09/2026", 130, 18]],
      Indicadores: [
        ["Mês", "Indicador", "Valor", "Formato"],
        ["09/2026", "Novos Clientes", 7, "Número"],
        ["09/2026", "Clientes Recorrentes", 3, "Número"],
        ["09/2026", "ROI Geral", 7.42, "Multiplicador"],
        ["09/2026", "Receita acumulado (maio a setembro)", 23400, "Moeda"],
        ["09/2026", "Marcações para o mês seguinte", 3, "Número"],
      ],
    });
    const sep = r.data(0);
    expect(sep.customers).toEqual({ new: 7, returning: 3 });
    expect(sep.extraMetrics.map((e) => [e.label, e.format])).toEqual([
      ["ROI Geral", "multiplier"],
      ["Receita acumulado (maio a setembro)", "currency"],
      ["Marcações para o mês seguinte", "integer"],
    ]);
    const warning = r.issues.warnings.find((w) => w.code === "computed_indicators")?.message ?? "";
    expect(warning).toContain("ROI Geral");
    expect(warning).toContain("Receita acumulado");
    expect(warning).not.toContain("Marcações");
  });

  it("aba Clientes no formato Tipo | Quantidade e colunas de novos/recorrentes no Funil", () => {
    const long = read({ Funil: [["Mês", "Leads", "Comparecimentos"], ["08/2026", 172, 37]], Clientes: [["Mês", "Tipo", "Quantidade"], ["08/2026", "Novos", 22], ["08/2026", "Recorrentes", 15]] });
    expect(long.data(0).customers).toEqual({ new: 22, returning: 15 });
    const wide = read({ Funil: [["Mês", "Leads", "Comparecimentos", "Novos clientes", "Recorrentes"], ["08/2026", 172, 37, 22, 15]] });
    expect(wide.data(0).funnel.map((s) => s.label)).toEqual(["Leads", "Comparecimentos"]);
    expect(wide.data(0).customers).toEqual({ new: 22, returning: 15 });
  });
});

describe("comercial flexível: telas", () => {
  const r = read(SERENITY);
  const [jul, aug] = [r.data(0), r.data(1)];

  it("mês: novos e recorrentes no resumo, tabelas livres e item só com status fora da lista", () => {
    const vm = buildCommercialViewModel(aug, { previous: entry(jul), history: [entry(jul), entry(aug)], dashboard });
    const novos = vm.secondary.find((k) => k.key === "newCustomers");
    expect(novos?.value).toBe(22);
    expect(novos?.footnote).toBe("59% dos clientes");
    expect(novos?.comparison?.trend).toBe("down");
    expect(vm.tables[0].title).toBe("Plano de ação");
    expect(vm.dimensions[0].rows.map((x) => x.label)).toEqual(["Bruna", "Marina"]);
  });

  it("visão geral: ranking acumulado com status mais recente, retorno por canal pago e novos × recorrentes", () => {
    const vm = buildCommercialOverview([entry(jul), entry(aug)], { dashboard });
    expect(vm.secondary.find((k) => k.key === "newCustomers")?.value).toBe(50);
    expect(vm.customerSeries?.map((s) => s.key)).toEqual(["newCustomers", "returningCustomers"]);

    const therapists = vm.dimensions.find((d) => d.label === "Terapeutas")!;
    expect(therapists.measure).toBe("revenue");
    expect(therapists.rows.map((x) => [x.label, x.quantity, x.revenue, x.status])).toEqual([
      ["Marina", 32, 11200, "Destaque Ago"],
      ["Bruna", 15, 5060, "Destaque Ago"],
      ["Larissa", 10, 1890, "Inativa Ago"],
    ]);
    expect(therapists.rows[0].averageTicket).toBeCloseTo(350, 6);
    expect(therapists.rows[0].byPeriod).toEqual({ "2026-07": 19, "2026-08": 13 });
    expect(therapists.periodMeasureLabel).toBe("Atendimentos");

    const paid = vm.paidChannels!;
    expect(paid.groups.map((g) => g.label)).toEqual(["ADS (Meta)", "Sites de Massagem", "Total pago"]);
    expect(paid.rows[1].values["sites-de-massagem.roas"]).toBeCloseTo(2300 / 220, 6);
    expect(paid.total?.["paid.revenue"]).toBe(2045 + 1050 + 2150 + 2300);
    expect(paid.total?.["paid.roas"]).toBeCloseTo(7545 / (369.49 + 220 + 371.56 + 220), 6);

    const channels = vm.channels!.rows;
    expect(channels.find((c) => c.key === "cliente-recorrente")?.revenue).toBe(10590);
    expect(channels.find((c) => c.key === "ads-meta")?.roas).toBeCloseTo((2045 + 2150) / (369.49 + 371.56), 6);
  });

  it("cliente sem esses dados não ganha as seções (Isabor: sem clientes, sem detalhamentos)", () => {
    const isabor = read({ Funil: [["Mês", "Leads", "Agendamentos", "Comparecimentos"], ["08/2026", 257, 14, 8], ["09/2026", 130, 23, 18]], Financeiro: [["Mês", "Receita", "Investimento em mídia"], ["08/2026", 3400, 1208.17], ["09/2026", 7750, 1044.45]] });
    const vm = buildCommercialOverview([entry(isabor.data(0)), entry(isabor.data(1))], { dashboard });
    expect(vm.customerSeries).toBeNull();
    expect(vm.dimensions).toEqual([]);
    expect(vm.paidChannels).toBeNull();
    expect(vm.secondary.some((k) => k.key === "newCustomers")).toBe(false);
    expect(buildCommercialViewModel(isabor.data(1), { previous: null, history: [], dashboard }).tables).toEqual([]);
    expect(monthPeriod(2026, 9).start).toBe(isabor.data(1).period.start);
  });
});
