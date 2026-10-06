import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { useMemoryStorage } from "./helpers/setup";
import { readExcel } from "@/lib/parsers/xlsx";
import { readPastedData } from "@/lib/parsers/markdown";
import { normalizeTraffic } from "@/features/traffic/normalize";
import { normalizeCommercial } from "@/features/commercial/normalize";
import { trafficSummary } from "@/features/traffic/metrics";
import { buildTrafficOverview } from "@/features/traffic/overview";
import { TrafficDataSchema, type TrafficData, type TrafficDataInput } from "@/features/traffic/schema";
import { IssueCollector } from "@/features/uploads/issues";
import { workbookBuffer } from "@/features/uploads/templates";
import { createClient } from "@/features/clients/service";
import { confirmImport, initImport, processImport, publishImportDrafts, receiveFile } from "@/features/uploads/service";
import { createDraftReport, getReportData, getReportManifest, publishReport } from "@/features/reports/service";
import { loadPortalModel } from "@/features/portal/model";
import { getRepositories } from "@/server/repositories";
import { monthPeriod, periodKey, weekPeriod, type Period } from "@/lib/dates/period";
import type { ReportIndexEntry } from "@/features/reports/schema";
import type { ClientInput } from "@/features/clients/input";

const month = { granularity: "month" as const, requestedPeriod: null, clientNames: [] };
const week = { granularity: "week" as const, requestedPeriod: null, clientNames: [] };

function book(rows: Array<Array<string | number | null>>, name = "Planilha1") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return readExcel(workbookBuffer(wb), "xlsx");
}
const data = (r: { periods: Array<{ data: unknown }> }, i = 0): TrafficData => TrafficDataSchema.parse(r.periods[i].data);

describe("tráfego: periodicidade do cliente", () => {
  it("cliente mensal: semanas dentro do mês são somadas no mês", () => {
    const issues = new IssueCollector();
    const r = normalizeTraffic(
      book([
        ["Início", "Fim", "Campanha", "Investimento", "Impressões"],
        ["2026-08-03", "2026-08-09", "Mensagens", 100, 1000],
        ["2026-08-10", "2026-08-16", "Mensagens", 200, 2000],
      ]),
      { ...month, platform: "meta_ads" },
      issues,
    );
    expect(issues.errors).toEqual([]);
    expect(r.periods.map((p) => p.period)).toEqual([monthPeriod(2026, 8)]);
    expect(data(r).campaigns[0]).toMatchObject({ investment: 300, impressions: 3000 });
  });

  it("cliente mensal: semana que atravessa dois meses é recusada com orientação", () => {
    const issues = new IssueCollector();
    normalizeTraffic(book([["Início", "Fim", "Campanha", "Investimento", "Impressões"], ["2026-07-27", "2026-08-02", "Mensagens", 100, 1000]]), { ...month, platform: "meta_ads" }, issues);
    expect(issues.errors.map((e) => e.code)).toEqual(["period_cadence"]);
    expect(issues.errors[0].message).toMatch(/mensais.*divisão por mês/);
  });

  it("cliente semanal: dados por mês são recusados; dias da mesma semana viram a semana", () => {
    const wrong = new IssueCollector();
    normalizeTraffic(book([["Mês", "Campanha", "Investimento", "Impressões"], ["2026-08-01", "Pesquisa", 100, 1000]]), { ...week, platform: "google_ads" }, wrong);
    expect(wrong.errors.map((e) => e.code)).toEqual(["period_cadence"]);

    const ok = new IssueCollector();
    const r = normalizeTraffic(
      book([
        ["Dia", "Campanha", "Investimento", "Impressões", "Alcance"],
        ["22/09/2026", "Pesquisa", 10, 100, 80],
        ["23/09/2026", "Pesquisa", 20, 200, 90],
      ]),
      { ...week, platform: "google_ads" },
      ok,
    );
    expect(ok.errors).toEqual([]);
    expect(r.periods.map((p) => p.period)).toEqual([weekPeriod("2026-09-21")]);
    // Alcance não soma entre dias: fica sem informação (com aviso).
    expect(data(r).campaigns[0]).toMatchObject({ investment: 30, reach: null });
    expect(ok.warnings.map((w) => w.code)).toContain("rows_merged");
  });
});

describe("tráfego: exportações do Meta e do Google", () => {
  it("CTR não é lido como cliques e as datas do relatório têm prioridade sobre a agenda da campanha", () => {
    const issues = new IssueCollector();
    const r = normalizeTraffic(
      book([
        ["Nome da campanha", "Início", "Término", "Início dos relatórios", "Término dos relatórios", "Valor usado (BRL)", "Impressões", "Cliques no link", "CTR (taxa de cliques no link)"],
        ["Mensagens", "2026-01-10", "Em andamento", "2026-08-01", "2026-08-31", 864.99, 60500, 1384, "2,29%"],
      ]),
      { ...month, platform: "meta_ads" },
      issues,
    );
    expect(issues.errors).toEqual([]);
    expect(r.periods[0].period).toEqual(monthPeriod(2026, 8));
    expect(data(r).campaigns[0]).toMatchObject({ clicks: null, linkClicks: 1384 });
  });

  it("alcance e cliques não viram resultado; visualização de vídeo não é visita", () => {
    const issues = new IssueCollector();
    const r = normalizeTraffic(
      book([
        ["Mês", "Campanha", "Investimento", "Impressões", "Resultados", "Indicador de resultado"],
        ["08/2026", "Mensagens", 100, 1000, 120, "actions:onsite_conversion.messaging_conversation_started_7d"],
        ["08/2026", "Reconhecimento", 50, 90000, 90000, "reach"],
        ["08/2026", "Tráfego", 30, 5000, 800, "actions:link_click"],
        ["08/2026", "Vídeo", 20, 8000, 4000, "actions:video_view"],
      ]),
      { ...month, platform: "meta_ads" },
      issues,
    );
    const campaigns = data(r).campaigns;
    expect(campaigns.map((c) => [c.name, c.results, c.resultType, c.resultLabel])).toEqual([
      ["Mensagens", 120, "whatsapp", null],
      ["Reconhecimento", null, null, null],
      ["Tráfego", null, null, null],
      ["Vídeo", null, null, null],
    ]);
    expect(issues.warnings.map((w) => w.code)).toContain("non_result_metric");
  });

  it("upload só do Google mantém Display e YouTube (coluna Rede) e lê números em inglês", () => {
    const issues = new IssueCollector();
    const r = normalizeTraffic(
      book([
        ["Campanha", "Rede (com parceiros de pesquisa)", "Mês", "Custo", "Impr.", "Cliques"],
        ["Pesquisa", "Pesquisa", "2026-08-01", 300, "12,345", "1,020"],
        ["Remarketing", "Display", "2026-08-01", 100, "40,000", 200],
        ["Vídeo", "YouTube", "2026-08-01", 200, "15,000", 90],
      ]),
      { ...month, platform: "google_ads" },
      issues,
    );
    expect(issues.warnings.map((w) => w.code)).not.toContain("other_platform_rows");
    const campaigns = data(r).campaigns;
    expect(campaigns.reduce((s, c) => s + c.investment, 0)).toBe(600);
    expect(campaigns[0]).toMatchObject({ platform: "google_ads", impressions: 12345, clicks: 1020 });
  });

  it("recusa valores que não dá para ler com segurança (1.5k, 12 mil)", () => {
    const issues = new IssueCollector();
    normalizeTraffic(book([["Mês", "Campanha", "Investimento", "Impressões"], ["08/2026", "X", "1.5k", 1000]]), { ...month, platform: "meta_ads" }, issues);
    expect(issues.errors.map((e) => e.code)).toEqual(["invalid_number"]);
  });

  it("duas abas com os mesmos números (resumo e detalhe) não são somadas", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Mês", "Plataforma", "Investimento", "Impressões"], ["08/2026", "Meta", 1000, 9000]]), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Mês", "Plataforma", "Campanha", "Investimento", "Impressões"], ["08/2026", "Meta", "A", 600, 5000], ["08/2026", "Meta", "B", 400, 4000]]), "Detalhamento");
    const issues = new IssueCollector();
    const r = normalizeTraffic(readExcel(workbookBuffer(wb), "xlsx"), month, issues);
    expect(data(r).campaigns.reduce((s, c) => s + c.investment, 0)).toBe(1000);
    expect(issues.warnings.map((w) => w.code)).toContain("sheet_ignored");
  });
});

describe("comercial colado", () => {
  const ctxWeek = { granularity: "week" as const, requestedPeriod: null };
  const ctxMonth = { granularity: "month" as const, requestedPeriod: null };

  it("aceita período semanal como intervalo e ignora linhas de Total", () => {
    const issues = new IssueCollector();
    const wb = readPastedData(
      Buffer.from(["## Funil", "| Semana | Leads | Vendas |", "|---|---|---|", "| 21/09/2026 a 27/09/2026 | 40 | 4 |", "| Total | 40 | 4 |", "", "## Canais", "| Semana | Canal | Leads |", "|---|---|---|", "| 21/09/2026 | Instagram | 40 |", "| **Total** | | 40 |"].join("\n")),
      "Funil",
    );
    const r = normalizeCommercial(wb, ctxWeek, issues);
    expect(issues.errors).toEqual([]);
    expect(r.periods.map((p) => p.period)).toEqual([weekPeriod("2026-09-21")]);
    expect((r.periods[0].data as { channels: unknown[] }).channels).toHaveLength(1);
  });

  it("segunda tabela sem título é erro (não vira um detalhamento chamado Tabela 2)", () => {
    const issues = new IssueCollector();
    const wb = readPastedData(Buffer.from(["| Mês | Leads |", "|---|---|", "| 01/2026 | 10 |", "", "| Mês | Receita |", "|---|---|", "| 01/2026 | 500 |"].join("\n")), "Funil");
    normalizeCommercial(wb, ctxMonth, issues);
    expect(issues.errors.map((e) => e.code)).toEqual(["untitled_table"]);
  });

  it("colunas de taxa e total do funil não viram etapas", () => {
    const issues = new IssueCollector();
    const wb = readPastedData(Buffer.from(["## Funil", "| Mês | Leads | Vendas | Taxa de conversão (%) |", "|---|---|---|---|", "| 01/2026 | 100 | 10 | 10% |"].join("\n")), "Funil");
    const r = normalizeCommercial(wb, ctxMonth, issues);
    expect((r.periods[0].data as { funnel: Array<{ label: string }> }).funnel.map((s) => s.label)).toEqual(["Leads", "Vendas"]);
  });
});

function entry(period: Period, campaigns: TrafficDataInput["campaigns"]): ReportIndexEntry {
  const { summary, labels } = trafficSummary(TrafficDataSchema.parse({ schemaVersion: 1, period, campaigns }));
  const now = "2026-09-01T12:00:00.000Z";
  return { id: `rp_${periodKey(period)}`, type: "traffic", kind: "dataset", period, periodKey: periodKey(period), title: null, status: "published", summary, labels, allowDownload: false, retroactive: false, updatedAt: now, publishedAt: now, createdAt: now, sourceType: "xlsx", sourceFileName: null, insightCount: 0 };
}

describe("visão geral: mesmas regras do relatório do mês", () => {
  it("custo por plataforma considera só campanhas com resultado; CTR conta meses sem clique", () => {
    const vm = buildTrafficOverview([
      entry(monthPeriod(2026, 1), [
        { id: "a", platform: "meta_ads", name: "A", investment: 1000, impressions: 10000, clicks: 0, results: 100, resultType: "whatsapp" },
        { id: "b", platform: "meta_ads", name: "B", investment: 500, impressions: 10000, results: null },
      ]),
      entry(monthPeriod(2026, 2), [{ id: "a", platform: "meta_ads", name: "A", investment: 1000, impressions: 10000, clicks: 100, results: 100, resultType: "whatsapp" }]),
    ]);
    expect(vm.table.rows[0].values["costPerResult"]).toBe(10);
    expect(vm.table.total?.["platform.meta_ads.costPerResult"]).toBe(10);
    expect([...vm.kpis, ...vm.secondary].find((k) => k.key === "ctr")?.value).toBeCloseTo(100 / 20000, 9);
  });
});

describe("rascunhos, mesclagem e publicação", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  const input: ClientInput = {
    name: "Lucas Ortodontia",
    shortName: "Lucas",
    slug: "lucas",
    greetingName: "",
    segment: "",
    currency: "BRL",
    notes: "",
    roiMetric: "roas",
    commercial: { enabled: false, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
    traffic: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
  };

  async function paste(clientId: string, text: string, platform: "meta_ads" | "google_ads") {
    const body = Buffer.from(text);
    const init = await initImport({ clientId, reportType: "traffic", fileName: "dados-colados.md", size: body.length, contentType: "text/markdown", platform });
    await receiveFile(init.importId, body);
    const record = await processImport(init.importId);
    return confirmImport(record.id, { periodKeys: record.preview!.suggestedPeriodKeys });
  }

  const meta = (inv: number) => `| Mês | Campanha | Investimento | Impressões | Contatos |\n|---|---|---|---|---|\n| 08/2026 | Mensagens | ${inv} | 5000 | 20 |`;
  const google = "| Mês | Campanha | Custo | Impr. | Conversões |\n|---|---|---|---|---|\n| 08/2026 | Pesquisa | 300 | 2000 | 10 |";

  it("um rascunho antigo não serve de base nem é publicado por cima da versão nova", async () => {
    const client = await createClient(input, null);
    const metaV1 = await paste(client.id, meta(100), "meta_ads");
    const metaV2 = await paste(client.id, meta(150), "meta_ads");
    await publishReport(client.id, metaV2.reportIds[0], null);
    // Ao publicar a v2, o rascunho v1 (mais antigo) fica substituído.
    expect((await getReportManifest(client.id, metaV1.reportIds[0]))?.status).toBe("superseded");

    const withGoogle = await paste(client.id, google, "google_ads");
    const merged = await getReportData((await getReportManifest(client.id, withGoogle.reportIds[0]))!);
    expect(merged?.type === "traffic" && merged.data.campaigns.map((c) => [c.platform, c.investment])).toEqual([
      ["meta_ads", 150],
      ["google_ads", 300],
    ]);
    // Publicar todos de uma importação antiga não derruba a versão mais nova.
    expect(await publishImportDrafts(metaV1.id, null)).toBe(0);
  });

  it("mensagens de dados colados falam em tabela, não em aba", async () => {
    const client = await createClient(input, null);
    const body = Buffer.from("| Mês | Campanha | Investimento |\n|---|---|---|\n| 08/2026 | X | 10 |");
    const init = await initImport({ clientId: client.id, reportType: "traffic", fileName: "dados-colados.md", size: body.length, contentType: "text/markdown", platform: "meta_ads", allowDownload: true });
    await receiveFile(init.importId, body);
    const record = await processImport(init.importId);
    expect(record.allowDownload).toBe(false);
    expect(record.issues[0].message).toMatch(/Impressões não foi encontrada na tabela Campanhas/);
  });

  it("portal não mistura semanas e meses na visão geral", async () => {
    const client = await createClient(input, null);
    const make = async (period: Period, inv: number) => {
      const d = TrafficDataSchema.parse({ schemaVersion: 1, period, campaigns: [{ id: "x", platform: "meta_ads", name: "X", investment: inv, impressions: 1000 }] });
      const r = await createDraftReport({ clientId: client.id, type: "traffic", kind: "dataset", period, source: null, data: { type: "traffic", data: d } });
      await publishReport(client.id, r.id, null);
    };
    await make(monthPeriod(2026, 7), 100);
    await make(monthPeriod(2026, 8), 200);
    await make(weekPeriod("2026-08-03"), 50);
    const model = await loadPortalModel((await getRepositories().clients.get(client.id))!, { mode: "client", tab: "trafego" });
    expect(model.overview?.map((e) => e.periodKey)).toEqual(["2026-07", "2026-08"]);
  });
});
