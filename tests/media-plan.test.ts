import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryStorage } from "./helpers/setup";
import { readExcel } from "@/lib/parsers/xlsx";
import { readPastedData } from "@/lib/parsers/markdown";
import { monthPeriod, periodKey, weekPeriod } from "@/lib/dates/period";
import { IssueCollector } from "@/features/uploads/issues";
import { mediaPlanTemplateWorkbook, workbookBuffer } from "@/features/uploads/templates";
import { pasteExample } from "@/features/uploads/components/format-guide";
import { normalizeMediaPlan } from "@/features/media-plan/normalize";
import { MediaPlanDataSchema, type MediaPlanData } from "@/features/media-plan/schema";
import { mediaPlanSummary } from "@/features/media-plan/metrics";
import { buildMediaPlanViewModel } from "@/features/media-plan/view-model";
import { computeDelivery } from "@/features/reports/delivery";
import { createClient } from "@/features/clients/service";
import { confirmImport, initImport, processImport, publishImportDrafts, receiveFile } from "@/features/uploads/service";
import { createDraftReport, getReportManifest, publishReport } from "@/features/reports/service";
import { TrafficDataSchema } from "@/features/traffic/schema";
import { trafficSummary } from "@/features/traffic/metrics";
import { loadPortalModel } from "@/features/portal/model";
import { getRepositories } from "@/server/repositories";
import type { ClientInput } from "@/features/clients/input";
import type { ReportIndexEntry } from "@/features/reports/schema";

const october = monthPeriod(2026, 10);
const plan = (r: { periods: Array<{ data: unknown }> }, i = 0): MediaPlanData => MediaPlanDataSchema.parse(r.periods[i].data);

/** Plano no formato do modelo "Estratégia de Mídia" (COREO), colado como tabelas Markdown. */
const COREO = [
  "## Apresentação",
  "| Campo | Valor |",
  "|---|---|",
  "| Título | Estratégia de Mídia — Clínica COREO |",
  "| Chamada | Captação contínua + ações especiais |",
  "| Resumo | R$ 50 por dia para manter a captação de implantes e reabilitação ativa o mês inteiro. |",
  "| Etiquetas | Ciclo contínuo · 30 dias; Verba dinâmica; Meta Ads · WhatsApp |",
  "| Atualizado em | 2026-09-22 |",
  "",
  "## Resumo",
  "| Indicador | Valor | Descrição |",
  "|---|---|---|",
  "| Orçamento-base | R$ 1.500 | 30 dias de captação |",
  "| Dia normal | R$ 50 | campanha contínua |",
  "| Dia especial | R$ 70 | R$ 40 contínua + R$ 30 ação |",
  "| Acréscimo | R$ 20 | por dia de ação especial |",
  "",
  "## Campanhas",
  "| Campanha | Plataforma | Objetivo | Funil | Verba | Diário | % | Observações |",
  "|---|---|---|---|---|---|---|---|",
  "| Captação contínua — Implantes e Reabilitação | Meta Ads | Conversas no WhatsApp | Meio / fundo | R$ 1.500 | R$ 50 | 100% | Implantes como prioridade. |",
  "| Total | | | | R$ 1.500 | R$ 50 | 100% | |",
  "",
  "## Plataformas",
  "| Plataforma | Descrição |",
  "|---|---|",
  "| Meta Ads | R$ 50/dia durante 30 dias, com destino ao WhatsApp Business da clínica. |",
  "",
  "## Conteúdo",
  "| Seção | Formato | Título | Texto | Etiqueta | Posição |",
  "|---|---|---|---|---|---|",
  "| Direção executiva | Texto | | A COREO terá uma campanha contínua de R$ 50/dia. | | Topo |",
  "| Direção executiva | Destaque | Modelo flexível | O investimento total do mês será R$ 1.500 + R$ 20 por dia de ação especial. | | |",
  "| Distribuição dinâmica | Destaque | Fórmula | Total do mês = R$ 1.500 + (R$ 20 × dias de ação). | | |",
  "| Por que essas campanhas | Cartão | Captação contínua | Implante é a maior prioridade de margem e demanda. | R$ 50/dia | |",
  "| Por que essas campanhas | Cartão | Ação especial | Semanas temáticas têm janela própria. | R$ 30/dia | |",
  "| Plano de otimização dinâmico | Fase | Durante | Contínua R$ 40/dia + especial R$ 30/dia. / Acompanhar entrega e conversas. | | |",
  "",
  "## Distribuição dinâmica",
  "| Duração | Contínua no mês | Campanha especial | Acréscimo | Total do mês |",
  "|---|---|---|---|---|",
  "| 3 dias | R$ 1.470 | R$ 90 | R$ 60 | R$ 1.560 |",
  "| 5 dias | R$ 1.450 | R$ 150 | R$ 100 | R$ 1.600 |",
  "",
  "## Metas do ciclo",
  "| Meta | Valor | Descrição |",
  "|---|---|---|",
  "| Conversas da contínua | 60–125 | R$ 1.500 ÷ R$ 12–25 · estimativa inicial |",
  "| Custo da contínua | R$ 12–25 | investimento contínuo ÷ novas conversas |",
  "| Taxa de qualificação | ≥ 30% | qualificadas ÷ conversas |",
  "",
  "## Matriz de criativos",
  "| Frente | Ângulo | Gancho | CTA |",
  "|---|---|---|---|",
  "| Implantes | Função e segurança | Perdeu um ou mais dentes? | Agende sua avaliação. |",
].join("\n");

describe("plano de mídia: leitura", () => {
  it("lê o modelo do Estratégia de Mídia colado como tabelas, sem alterar os valores", () => {
    const issues = new IssueCollector();
    const r = normalizeMediaPlan(readPastedData(Buffer.from(COREO), "Plano"), { requestedPeriod: october }, issues);
    expect(issues.errors).toEqual([]);
    expect(r.periods.map((p) => p.periodKey)).toEqual(["2026-10"]);
    const d = plan(r);
    expect(d.header).toMatchObject({ title: "Estratégia de Mídia — Clínica COREO", tagline: "Captação contínua + ações especiais", updatedAt: "2026-09-22" });
    expect(d.header?.tags).toEqual(["Ciclo contínuo · 30 dias", "Verba dinâmica", "Meta Ads · WhatsApp"]);
    // Resumo e metas aparecem como foram escritos ("R$ 1.500", "60–125", "≥ 30%").
    expect(d.highlights.map((h) => [h.label, h.value, h.display])).toEqual([
      ["Orçamento-base", 1500, "R$ 1.500"],
      ["Dia normal", 50, "R$ 50"],
      ["Dia especial", 70, "R$ 70"],
      ["Acréscimo", 20, "R$ 20"],
    ]);
    expect(d.goals.map((g) => g.display)).toEqual(["60–125", "R$ 12–25", "≥ 30%"]);
    // Linha de Total ignorada; "%" é calculado pelo portal.
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ platform: "meta_ads", budget: 1500, dailyBudget: 50, funnel: "Meio / fundo", objective: "Conversas no WhatsApp" });
    expect(d.platforms).toEqual([{ platform: "meta_ads", description: "R$ 50/dia durante 30 dias, com destino ao WhatsApp Business da clínica." }]);
    // Seções na ordem do arquivo; a tabela "Distribuição dinâmica" entra na seção de mesmo nome, depois do destaque.
    expect(d.sections.map((s) => [s.title, s.placement, s.blocks.map((b) => b.kind)])).toEqual([
      ["Direção executiva", "top", ["text", "callout"]],
      ["Distribuição dinâmica", "bottom", ["callout", "table"]],
      ["Por que essas campanhas", "bottom", ["card", "card"]],
      ["Plano de otimização dinâmico", "bottom", ["phase"]],
      ["Matriz de criativos", "bottom", ["table"]],
    ]);
    expect(d.sections[1].blocks[1].rows[1]).toEqual(["5 dias", "R$ 1.450", "R$ 150", "R$ 100", "R$ 1.600"]);
  });

  it("o modelo XLSX e o exemplo do assistente passam na validação", () => {
    for (const wb of [readExcel(workbookBuffer(mediaPlanTemplateWorkbook()), "xlsx"), readPastedData(Buffer.from(pasteExample("media_plan", "monthly", null)), "Plano")]) {
      const issues = new IssueCollector();
      const r = normalizeMediaPlan(wb, { requestedPeriod: october }, issues);
      expect(issues.errors).toEqual([]);
      const d = plan(r);
      expect(d.items[0].budget).toBe(1500);
      expect(d.goals.length).toBeGreaterThan(0);
      expect(d.sections.find((s) => s.title === "Matriz de criativos")?.blocks[0].kind).toBe("table");
    }
  });

  it("vários meses pela coluna Mês; sem mês nenhum, pede o período", () => {
    const multi = ["## Plano", "| Mês | Campanha | Plataforma | Verba | Meta de leads |", "|---|---|---|---|---|", "| 10/2026 | Pesquisa | Google | 900 | 30 |", "| 11/2026 | Pesquisa | Google | 1.100 | 40 |"].join("\n");
    const issues = new IssueCollector();
    const r = normalizeMediaPlan(readPastedData(Buffer.from(multi), "Plano"), { requestedPeriod: null }, issues);
    expect(issues.errors).toEqual([]);
    expect(r.periods.map((p) => p.periodKey)).toEqual(["2026-10", "2026-11"]);
    expect(plan(r, 1).items[0]).toMatchObject({ platform: "google_ads", resultType: "lead", resultTarget: 40 });

    const none = new IssueCollector();
    normalizeMediaPlan(readPastedData(Buffer.from("| Campanha | Plataforma | Verba |\n| A | Meta | 100 |"), "Plano"), { requestedPeriod: null }, none);
    expect(none.errors.map((e) => e.code)).toContain("missing_period");
  });

  it("Formato Tabela no Conteúdo posiciona a tabela dentro da seção", () => {
    const text = [
      "| Campanha | Plataforma | Verba |",
      "| A | Meta | 100 |",
      "",
      "## Matriz de criativos",
      "| Frente | CTA |",
      "| Implantes | Agende |",
      "",
      "## Conteúdo",
      "| Seção | Formato | Texto |",
      "| Criativos | Tabela | Matriz de criativos |",
      "| Criativos | Destaque | Produção: quatro vídeos. |",
      "| Outra | Tabela | Tabela inexistente |",
    ].join("\n");
    const issues = new IssueCollector();
    const d = plan(normalizeMediaPlan(readPastedData(Buffer.from(text), "Plano"), { requestedPeriod: october }, issues));
    expect(d.sections.map((s) => [s.title, s.blocks.map((b) => b.kind)])).toEqual([["Criativos", ["table", "callout"]]]);
    expect(d.sections[0].blocks[0].rows).toEqual([["Implantes", "Agende"]]);
    expect(issues.warnings.map((w) => w.code)).toContain("table_not_found");
  });

  it("sem aba de campanhas é erro", () => {
    const issues = new IssueCollector();
    normalizeMediaPlan(readPastedData(Buffer.from("## Metas\n| Meta | Valor |\n| Leads | 100 |"), "Plano"), { requestedPeriod: october }, issues);
    expect(issues.errors.map((e) => e.code)).toContain("missing_sheet");
  });
});

describe("plano de mídia: tela e prazos", () => {
  const data = MediaPlanDataSchema.parse({
    schemaVersion: 1,
    period: october,
    items: [
      { id: "a", platform: "meta_ads", name: "Mensagens", budget: 900, resultType: "whatsapp", resultTarget: 90, start: "2026-10-01", end: "2026-10-31" },
      { id: "b", platform: "google_ads", name: "Pesquisa", budget: 600, resultType: "lead", resultTarget: 20 },
      { id: "c", platform: "Rádio", name: "Spot", budget: 500 },
    ],
    goals: [{ key: "conversas", label: "Conversas", value: null, display: "60–125" }],
  });

  it("planejado × realizado com o tráfego do mesmo mês; veículos fora do digital ficam de fora", () => {
    const traffic = TrafficDataSchema.parse({
      schemaVersion: 1,
      period: october,
      campaigns: [
        { id: "m", platform: "meta_ads", name: "Mensagens", investment: 450, impressions: 10000, results: 60, resultType: "whatsapp" },
        { id: "g", platform: "google_ads", name: "Pesquisa", investment: 300, impressions: 4000, results: 9, resultType: "lead" },
      ],
    });
    const { summary, labels } = trafficSummary(traffic);
    const actual = { id: "rp_trafficoct", type: "traffic", kind: "dataset", period: october, periodKey: "2026-10", title: null, status: "published", summary, labels, allowDownload: false, retroactive: false, updatedAt: "", publishedAt: "", createdAt: "", sourceType: "xlsx", sourceFileName: null, insightCount: 0 } satisfies ReportIndexEntry;
    const vm = buildMediaPlanViewModel(data, { previous: null, history: [], actual, today: "2026-10-16" });
    expect(vm.execution?.status).toBe("partial");
    expect(vm.execution?.total).toMatchObject({ planned: 1500, actual: 750, rate: 0.5 });
    expect(vm.execution?.offlineBudget).toBe(500);
    expect(vm.execution?.results.map((r) => [r.label, r.planned, r.actual])).toEqual([
      ["Conversas no WhatsApp", 90, 60],
      ["Leads", 20, 9],
    ]);
    expect(vm.goals[0].text).toBe("60–125");
    expect(vm.timeline?.rows).toHaveLength(3);
    expect(mediaPlanSummary(data).summary["platform.meta_ads.budget"]).toBe(900);
  });

  it("o plano do mês vence no próprio mês (planejamento)", () => {
    const planModule = { enabled: true, cadence: "monthly" as const, dueDay: 1, allowOriginalDownload: false };
    const d = computeDelivery({ module: planModule, reports: [], today: "2026-10-06", planning: true });
    expect(periodKey(d.expectedPeriod!)).toBe("2026-10");
    expect(d.state).toBe("pending");
    const regular = computeDelivery({ module: planModule, reports: [], today: "2026-10-06" });
    expect(periodKey(regular.expectedPeriod!)).toBe("2026-09");
  });
});

const baseInput: ClientInput = {
  name: "Clínica Teste",
  shortName: "Clínica",
  slug: "clinica",
  greetingName: "",
  segment: "",
  currency: "BRL",
  notes: "",
  roiMetric: "roas",
  commercial: { enabled: false, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
  traffic: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
};

async function paste(clientId: string, reportType: "traffic" | "media_plan", text: string, extra: Partial<Parameters<typeof initImport>[0]> = {}) {
  const body = Buffer.from(text);
  const init = await initImport({ clientId, reportType, fileName: "dados-colados.md", size: body.length, contentType: "text/markdown", ...extra });
  await receiveFile(init.importId, body);
  return processImport(init.importId);
}

describe("fluxo: plano de mídia no portal", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  it("colar → rascunho → publicar → aba Plano de mídia do cliente", async () => {
    const client = await createClient({ ...baseInput, media_plan: { enabled: true, cadence: "monthly", dueDay: 1, allowOriginalDownload: false } }, null);
    const record = await paste(client.id, "media_plan", COREO, { period: october });
    expect(record.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(record.preview?.periods[0].metrics[0]).toEqual({ label: "Investimento planejado", value: "R$ 1.500,00" });
    const done = await confirmImport(record.id, { periodKeys: ["2026-10"] });
    expect(await publishImportDrafts(done.id, null)).toBe(1);

    const model = await loadPortalModel(client, { tab: "plano-de-midia", mode: "client" });
    expect(model.tabs).toEqual(["traffic", "media_plan"]);
    expect(model.tab).toBe("media_plan");
    expect(model.overview).toBeNull();
    expect(model.selection.dataset?.data.type).toBe("media_plan");
  });

  it("recusa plano para cliente sem o módulo", async () => {
    const client = await createClient(baseInput, null);
    await expect(initImport({ clientId: client.id, reportType: "media_plan", fileName: "x.md", size: 10, contentType: "text/markdown" })).rejects.toThrow(/Plano de mídia/);
  });
});

describe("fluxo: tráfego retroativo", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  const MONTHS = ["| Mês | Plataforma | Investimento | Impressões | Resultados | Tipo de resultado |", "|---|---|---|---|---|---|", "| 06/2026 | Meta | 400 | 20.000 | 40 | WhatsApp |", "| 07/2026 | Meta | 420 | 21.000 | 44 | WhatsApp |", "| 08/2026 | Meta | 450 | 23.000 | 48 | WhatsApp |"].join("\n");

  it("sobe meses anteriores sem tocar no mês que já está no portal", async () => {
    const client = await createClient(baseInput, null);
    const aug = TrafficDataSchema.parse({ schemaVersion: 1, period: monthPeriod(2026, 8), campaigns: [{ id: "x", platform: "meta_ads", name: "Original", investment: 999, impressions: 1000 }] });
    const existing = await createDraftReport({ clientId: client.id, type: "traffic", kind: "dataset", period: aug.period, source: null, data: { type: "traffic", data: aug } });
    await publishReport(client.id, existing.id, null);

    const record = await paste(client.id, "traffic", MONTHS, { mode: "retroactive", period: monthPeriod(2026, 9) });
    expect(record.mode).toBe("retroactive");
    expect(record.requestedPeriod).toBeNull();
    expect(record.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(record.issues.map((i) => i.code)).toContain("retroactive_existing");
    expect(record.preview?.suggestedPeriodKeys).toEqual(["2026-06", "2026-07"]);

    const done = await confirmImport(record.id, { periodKeys: record.preview!.suggestedPeriodKeys });
    expect(await publishImportDrafts(done.id, null)).toBe(2);
    const manifest = await getReportManifest(client.id, done.reportIds[0]);
    expect(manifest?.retroactive).toBe(true);
    const index = await getRepositories().reports.getIndex(client.id);
    // Agosto continua sendo o relatório original.
    expect(index.reports.find((r) => r.periodKey === "2026-08" && r.status === "published")?.id).toBe(existing.id);
    expect(index.reports.filter((r) => r.status === "published").map((r) => r.periodKey).sort()).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("cliente semanal: os meses entram e o portal oferece a escala Meses ao lado das semanas", async () => {
    const client = await createClient({ ...baseInput, traffic: { enabled: true, cadence: "weekly", dueDay: 1, allowOriginalDownload: false } }, null);
    const week = weekPeriod("2026-09-21");
    const w = TrafficDataSchema.parse({ schemaVersion: 1, period: week, campaigns: [{ id: "x", platform: "meta_ads", name: "Semana", investment: 100, impressions: 1000 }] });
    const published = await createDraftReport({ clientId: client.id, type: "traffic", kind: "dataset", period: week, source: null, data: { type: "traffic", data: w } });
    await publishReport(client.id, published.id, null);

    // No envio normal, meses inteiros são recusados para cliente semanal; no retroativo, entram.
    const normal = await paste(client.id, "traffic", MONTHS);
    expect(normal.issues.some((i) => i.code === "period_cadence")).toBe(true);
    const retro = await paste(client.id, "traffic", MONTHS, { mode: "retroactive" });
    expect(retro.issues.filter((i) => i.level === "error")).toEqual([]);
    const done = await confirmImport(retro.id, { periodKeys: retro.preview!.suggestedPeriodKeys });
    await publishImportDrafts(done.id, null);

    const weekly = await loadPortalModel(client, { tab: "trafego", mode: "client" });
    expect(weekly.scales).toEqual(["month", "week"]);
    expect(weekly.scale).toBe("week");
    expect(weekly.periods.map((p) => p.key)).toEqual([periodKey(week)]);

    const monthly = await loadPortalModel(client, { tab: "trafego", scale: "meses", mode: "client" });
    expect(monthly.scale).toBe("month");
    expect(monthly.view).toBe("overview");
    expect(monthly.overview?.map((e) => e.periodKey)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("retroativo é só para tráfego e não aceita PDF", async () => {
    const client = await createClient({ ...baseInput, commercial: { ...baseInput.commercial, enabled: true } }, null);
    await expect(initImport({ clientId: client.id, reportType: "commercial", fileName: "x.md", size: 10, contentType: "text/markdown", mode: "retroactive" })).rejects.toThrow(/tráfego/);
    await expect(initImport({ clientId: client.id, reportType: "traffic", fileName: "x.pdf", size: 10, contentType: "application/pdf", mode: "retroactive" })).rejects.toThrow(/planilha/);
  });
});
