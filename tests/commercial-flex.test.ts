import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { readExcel } from "@/lib/parsers/xlsx";
import { readPastedData } from "@/lib/parsers/markdown";
import { IssueCollector } from "@/features/uploads/issues";
import { workbookBuffer } from "@/features/uploads/templates";
import { normalizeCommercial } from "@/features/commercial/normalize";
import { CommercialDataSchema, type CommercialData } from "@/features/commercial/schema";
import { commercialSummary } from "@/features/commercial/metrics";
import { buildCommercialDashboard, returnTone } from "@/features/commercial/dashboard";
import { notesFor, unplacedNotes } from "@/features/commercial/notes";
import type { ReportIndexEntry } from "@/features/reports/schema";

type Row = Array<string | number | null>;
const monthCtx = { granularity: "month" as const, requestedPeriod: null };
const dashboard = { roiMetric: "roas" as const, highlightMetrics: [], commercialLayout: "detalhamentos" as const };

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

describe("painel comercial (modelo Serenity)", () => {
  const r = read(SERENITY);
  const [jul, aug] = [r.data(0), r.data(1)];
  const vm = buildCommercialDashboard({ history: [entry(jul), entry(aug)], previous: entry(jul), data: aug, insights: [], dashboard: { ...dashboard, roiMetric: "roiPercent" } });

  it("mês em foco comparado ao anterior e acumulado do ano", () => {
    expect(vm.focus).toMatchObject({ name: "Agosto", previousName: "Julho", title: "Agosto 2026" });
    expect(vm.banner.map((b) => b.label)).toEqual(["Receita", "Leads", "Agendamentos", "Comparecimentos", "Ticket médio", "Conversão", "Novos clientes", "Recorrentes"]);
    const banner = Object.fromEntries(vm.banner.map((b) => [b.key, b]));
    expect(banner.revenue.value).toBe(12710);
    expect(banner.revenue.delta).toEqual({ text: "+2,1%", direction: "up" });
    expect(banner.conversionRate.delta).toEqual({ text: "−2,6 p.p.", direction: "down" });

    const acc = Object.fromEntries(vm.accumulated.map((k) => [k.key, k]));
    expect(acc.revenue.value).toBe(12445 + 12710);
    expect(acc.newCustomers.value).toBe(50);
    expect(acc.newCustomers.sub).toBe("64% dos clientes");
    expect(acc.investment.sub).toBe("ADS (Meta) + Sites de Massagem · 2 meses");
    expect(vm.rangeShort).toBe("Jul – Ago 2026");
    expect(vm.monthTable.rows.map((x) => x.badges.map((b) => b.text))).toEqual([[], ["Em foco"]]);
    expect(vm.variation?.rows.find((x) => x.key === "revenue")?.deltas).toEqual([null, { text: "+2,1%", direction: "up" }]);
  });

  it("canais e ROI: só a receita dos canais pagos entra no retorno", () => {
    const roi = vm.roi!;
    expect(roi.basis).toBe("channels");
    expect(roi.paidNames).toEqual(["ADS (Meta)", "Sites de Massagem"]);
    expect(roi.otherNames).toEqual(["Cliente Recorrente"]);
    const invested = 369.49 + 220 + 371.56 + 220;
    expect(roi.total.revenue).toBe(2045 + 1050 + 2150 + 2300);
    expect(roi.total.roas).toBeCloseTo(7545 / invested, 6);
    expect(roi.total.roi).toBeCloseTo(7545 / invested - 1, 6);
    expect(roi.table[1].rows[1]).toMatchObject({ label: "Agosto", focus: true, net: 2080 });
    expect(roi.months.map((m) => m.label)).toEqual(["Julho", "Agosto"]);

    const ch = vm.channels!;
    expect(ch.table.rows.find((c) => c.key === "cliente-recorrente")?.revenue).toBe(10590);
    expect(ch.table.rows.find((c) => c.key === "ads-meta")?.byPeriod).toEqual({ "2026-07": 95, "2026-08": 95 });
    expect(ch.distributions.map((d) => [d.key, d.kind])).toEqual([
      ["leads", "donut"],
      ["receita", "donut"],
    ]);
  });

  it("detalhamento: ranking acumulado com status mais recente e item novo no mês", () => {
    const t = vm.dimensions.find((d) => d.label === "Terapeutas")!;
    expect(t.rankedBy).toBe("revenue");
    expect(t.rows.map((x) => [x.rank, x.label, x.quantity, x.revenue, x.status])).toEqual([
      [1, "Marina", 32, 11200, "Destaque Ago"],
      [2, "Bruna", 15, 5060, "Destaque Ago"],
      [3, "Larissa", 10, 1890, "Inativa Ago"],
    ]);
    expect(t.rows[0].averageTicket).toBeCloseTo(350, 6);
    expect(t.rows[0].byPeriod).toEqual({ "2026-07": 19, "2026-08": 13 });
    expect(t.rows.map((x) => [x.label, x.isNew, x.statusTone])).toEqual([
      ["Marina", false, "positive"],
      ["Bruna", true, "positive"],
      ["Larissa", false, "negative"],
    ]);
    expect(t.periodMeasureLabel).toBe("Atendimentos");
  });

  it("plano de ação vira cartões para o mês seguinte", () => {
    expect(vm.actionPlans).toMatchObject([
      {
        key: "plano-de-acao",
        title: "Plano de ação para Setembro",
        items: [
          { tag: "Prioridade 1 · Conversão", title: "Recuperar a conversão Lead → Agendamento para ≥ 27%", text: "" },
          { tag: "Prioridade 2 · Sites", title: "Escalar o investimento nos Sites de Massagem", text: "" },
        ],
      },
    ]);
    expect(vm.tables).toEqual([]);
  });

  it("tema dos insights, leituras do Comparativo e aviso do mês na tabela", () => {
    const full = read({
      ...SERENITY,
      Insights: [
        ["Mês", "Tipo", "Tema", "Título", "Descrição"],
        ["08/2026", "Positivo", "Recorrência", "Recorrência lidera", "15 clientes recorrentes."],
      ],
      Comparativo: [
        ["Mês", "Indicador", "Leitura"],
        ["08/2026", "Leads", "Estável"],
        ["08/2026", "ROI canais pagos", "Sites puxaram o resultado"],
        ["08/2026", "Dias úteis", "Mês com feriado"],
      ],
      Contexto: [
        ["Mês", "Título", "Descrição"],
        ["07/2026", "Julho parcial", "Dados a partir de 15/07."],
      ],
    });
    expect(full.issues.errors).toEqual([]);
    expect(full.sheets.at(-2)?.recognizedAs).toBe("Comparativo (leituras)");
    expect(full.periods[1].insights).toEqual([{ type: "positive", title: "Recorrência lidera", description: "15 clientes recorrentes.", tag: "Recorrência" }]);
    const [j, a] = [full.data(0), full.data(1)];
    expect(entry(j).labels.context).toBe("Julho parcial");
    const vm2 = buildCommercialDashboard({
      history: [entry(j), entry(a)],
      previous: entry(j),
      data: a,
      insights: [
        { id: "in_1", type: "positive", title: "Recorrência lidera", description: "", tag: "Recorrência", source: "import" },
        { id: "in_2", type: "attention", title: "Sem tema", description: "", tag: null, source: "import" },
      ],
      dashboard,
    });
    expect(vm2.insights.map((i) => i.tag)).toEqual(["Recorrência", "Atenção"]);
    const notes = Object.fromEntries(vm2.comparison!.rows.map((x) => [x.label, x.note]));
    expect(notes.Leads).toBe("Estável");
    expect(notes["Retorno dos canais pagos"]).toBe("Sites puxaram o resultado");
    expect(notes["Dias úteis"]).toBe("Mês com feriado");
    expect(vm2.comparison?.rows.find((x) => x.key === "finalRate")).toMatchObject({ label: "Taxa de comparecimento", current: 37 / 43 });
    expect(vm2.monthTable.rows[0].badges).toEqual([{ text: "Parcial", tone: "attention", title: "Julho parcial" }]);
  });

  it("acumulado é do ano do mês em foco; a comparação atravessa o ano", () => {
    const month = (m: number, y: number, leads: number) => {
      const key = `${String(m).padStart(2, "0")}/${y}`;
      return read({ Funil: [["Mês", "Leads", "Comparecimentos"], [key, leads, 10]], Financeiro: [["Mês", "Receita"], [key, 1000]] }).data(0);
    };
    const [dec, jan] = [month(12, 2025, 100), month(1, 2026, 120)];
    const vm3 = buildCommercialDashboard({ history: [entry(dec), entry(jan)], previous: entry(dec), data: jan, insights: [], dashboard });
    expect(vm3.months).toBe(1);
    expect(vm3.rangeShort).toBe("Janeiro 2026");
    expect(vm3.focus.previousName).toBe("Dezembro");
    expect(vm3.banner.find((b) => b.key === "stage.leads")?.delta?.text).toBe("+20,0%");
    expect(vm3.variation).toBeNull();
    expect(vm3.accumulated.find((k) => k.key === "leads")?.value).toBe(120);
  });

  it("cliente sem esses dados não ganha as seções (Isabor: sem clientes, sem detalhamentos)", () => {
    const isabor = read({
      Funil: [
        ["Mês", "Leads", "Agendamentos", "Comparecimentos"],
        ["08/2026", 257, 14, 8],
        ["09/2026", 130, 23, 18],
      ],
      Financeiro: [
        ["Mês", "Receita", "Investimento em mídia"],
        ["08/2026", 3400, 1208.17],
        ["09/2026", 7750, 1044.45],
      ],
    });
    const vm4 = buildCommercialDashboard({ history: [entry(isabor.data(0)), entry(isabor.data(1))], previous: entry(isabor.data(0)), data: isabor.data(1), insights: [], dashboard });
    expect(vm4.channels).toBeNull();
    expect(vm4.dimensions).toEqual([]);
    expect(vm4.actionPlans).toEqual([]);
    expect(vm4.roi?.basis).toBe("total");
    expect(vm4.roi?.total.roas).toBeCloseTo((3400 + 7750) / (1208.17 + 1044.45), 6);
    expect(vm4.accumulated.some((k) => k.key === "newCustomers")).toBe(false);
    expect(vm4.charts.map((c) => c.key)).toEqual(["receita", "funil", "conversao", "investimento"]);
    // Relatório fora do histórico (ex.: prévia de um rascunho) também monta o painel.
    expect(buildCommercialDashboard({ history: [], previous: null, data: isabor.data(1), insights: [], dashboard }).months).toBe(1);
  });
});

/** Formato da Dra. Isabor: funil de 3 etapas, dois canais pagos, agenda já marcada e notas por seção. */
const ISABOR: Record<string, Row[]> = {
  Funil: [
    ["Mês", "Leads", "Agendamentos", "Comparecimentos"],
    ["05/2026", 115, 13, 10],
    ["06/2026", 77, 13, 7],
    ["07/2026", 116, 12, 12],
    ["08/2026", 257, 14, 8],
    ["09/2026", 130, 23, 18],
  ],
  Financeiro: [
    ["Mês", "Receita", "Investimento em mídia"],
    ["05/2026", 4150, 1409.56],
    ["06/2026", 2950, 1155.02],
    ["07/2026", 5150, 1184.67],
    ["08/2026", 3400, 1208.17],
    ["09/2026", 7750, 1044.45],
  ],
  Canais: [
    ["Mês", "Canal", "Tipo", "Leads", "Comparecimentos", "Receita", "Investimento"],
    ["08/2026", "Instagram (Meta Ads)", "Mídia paga", 217, 1, 450, 770.45],
    ["08/2026", "Google Ads", "Mídia paga", 26, 0, 0, 437.72],
    ["08/2026", "Indicação", "Indicação", null, null, 2500, null],
    ["09/2026", "Instagram (Meta Ads)", "Mídia paga", 89, 8, 3550, 697.9],
    ["09/2026", "Google Ads", "Mídia paga", 26, 1, 450, 346.55],
    ["09/2026", "Indicação", "Indicação", 15, 9, 3750, null],
  ],
  Oportunidades: [
    ["Mês", "Origem", "Data agendada", "Situação"],
    ["09/2026", "Indicação", "02/10/2026", "Aguardando atendimento"],
    ["09/2026", "Indicação", "02/10/2026", "Aguardando atendimento"],
    ["09/2026", "Google", "28/10/2026", "Aguardando atendimento"],
  ],
  "Plano de ação": [
    ["Mês", "#", "Ação", "Impacto esperado", "Urgência"],
    ["09/2026", 1, "Qualificar o lead antes do contato comercial", "Reduzir as perdas recorrentes", "Alta"],
  ],
  Notas: [
    ["Mês", "Seção", "Texto"],
    ["09/2026", "Funil", "Menos volume, muito mais qualidade."],
    ["09/2026", "Receita por canal", "Instagram virou canal de receita."],
    ["09/2026", "Bastidores", "Nota sem lugar no painel."],
  ],
};

describe("painel comercial: modelo funil (Isabor)", () => {
  const r = read(ISABOR);
  const months = [0, 1, 2, 3, 4].map((i) => r.data(i));
  const entries = months.map(entry);
  const funil = { ...dashboard, commercialLayout: "funil" as const };
  const vm = buildCommercialDashboard({ history: entries, previous: entries[3], data: months[4], insights: [], dashboard: funil });
  const fv = vm.funnelView!;

  it("lê a aba Notas e só monta o modelo funil para quem usa esse modelo", () => {
    expect(r.issues.errors).toEqual([]);
    expect(r.sheets.find((s) => s.name === "Notas")?.recognizedAs).toBe("Notas do painel");
    expect(months[4].sectionNotes.map((n) => n.section)).toEqual(["Funil", "Receita por canal", "Bastidores"]);
    expect(buildCommercialDashboard({ history: entries, previous: entries[3], data: months[4], insights: [], dashboard }).funnelView).toBeNull();
    expect(vm.layout).toBe("funil");
    expect(notesFor(vm.notes, "funil", "funil")).toEqual(["Menos volume, muito mais qualidade."]);
    expect(notesFor(vm.notes, "funil", "receita")).toEqual(["Instagram virou canal de receita."]);
    expect(unplacedNotes(vm.notes, "funil").map((n) => n.section)).toEqual(["Bastidores"]);
  });

  it("acumulado, destaque do mês e funil com as taxas entre etapas", () => {
    expect(fv.rangeArrow).toBe("Mai → Set");
    const acc = Object.fromEntries(fv.accumulated.map((k) => [k.key, k]));
    expect(acc["stage.leads"].value).toBe(695);
    expect(acc["stage.agendamentos"]).toMatchObject({ value: 75, sub: "10,8% dos leads" });
    expect(acc.revenue).toMatchObject({ value: 23400, highlight: true });
    expect(acc.investment.sub).toBe("Instagram (Meta Ads) + Google Ads");
    expect(fv.banner.map((b) => b.label)).toEqual(["Leads", "Comparecimentos", "Receita", "Ticket médio", "Conversão L→C"]);
    expect(fv.funnel.steps.map((s) => [s.label, s.rate])).toEqual([
      ["Lead → agendamento", 23 / 130],
      ["Agendamento → comparecimento", 18 / 23],
    ]);
    expect(fv.funnel.overall).toEqual({ label: "Lead → comparecimento", rate: 18 / 130 });
    expect(fv.focusChannels?.paid.map((c) => c.label)).toEqual(["Instagram (Meta Ads)", "Google Ads"]);
    expect(fv.focusChannels?.total).toMatchObject({ revenue: 7750, investment: 697.9 + 346.55, conversions: 18 });
  });

  it("comparativo do ano inteiro e retorno geral sobre a receita total", () => {
    expect(fv.comparativo.periods).toHaveLength(12);
    expect(fv.comparativo.periods.find((p) => p.focus)?.key).toBe("2026-09");
    const retorno = fv.comparativo.groups.find((g) => g.key === "retorno")!;
    expect(retorno.rows[0].values["2026-09"]).toBeCloseTo(7750 / 1044.45, 6);
    expect(retorno.rows[0].values["2026-01"]).toBeNull();
    expect(retorno.rows[0].total).toBeCloseTo(23400 / 6001.87, 6);
    expect(fv.comparativo.groups.map((g) => g.key)).toEqual(["funil", "conversoes", "financeiro", "midia", "retorno", "receita-canal"]);
    const roi = fv.roi!;
    expect(roi.story[0]).toBe("Cada R$ 1,00 investido em mídia retornou R$ 3,90 em receita.");
    expect(roi.story[1]).toMatch(/^Setembro foi o melhor mês em retorno \(7,42x\) e em receita \(R\$\s7\.750\), com o menor investimento da série \(R\$\s1\.044\)\.$/);
    expect(roi.story[2]).toBe("Em Setembro, só a receita vinda dos canais pagos já cobriu o investimento 3,83 vezes.");
    expect(roi.cards.map((c) => `${c.channel} ${c.month}`)).toEqual(["Instagram (Meta Ads) Agosto", "Google Ads Agosto", "Instagram (Meta Ads) Setembro", "Google Ads Setembro"]);
    expect(returnTone(roi.cards[1].roas)).toBe("negative");
    expect(returnTone(7.42)).toBe("positive");
  });

  it("diagnóstico: agenda já marcada e oportunidade com o volume do melhor mês", () => {
    expect(vm.opportunities).toHaveLength(1);
    expect(vm.opportunities[0]).toMatchObject({ title: "Agendamentos já marcados para Outubro", count: 3 });
    expect(vm.opportunities[0].potential).toBeCloseTo(3 * (7750 / 18), 6);
    expect(vm.tables).toEqual([]);
    expect(vm.actionPlans[0].table.columns).toEqual(["#", "Ação", "Impacto esperado", "Urgência"]);
    expect(fv.growth).toMatchObject({ peakName: "Agosto", peakLeads: 257, projected: 35, revenue: 15070, extra: 17, peakInvestment: 1208.17 });
    expect(fv.growth?.growth).toBeCloseTo(15070 / 7750 - 1, 6);
  });
});
