import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { useMemoryStorage } from "./helpers/setup";
import { readExcel } from "@/lib/parsers/xlsx";
import { readMarkdownTables, readPastedData } from "@/lib/parsers/markdown";
import { normalizeTraffic } from "@/features/traffic/normalize";
import { buildTrafficView } from "@/features/traffic/metrics";
import { TrafficDataSchema, type TrafficData } from "@/features/traffic/schema";
import { IssueCollector } from "@/features/uploads/issues";
import { workbookBuffer } from "@/features/uploads/templates";
import { createClient } from "@/features/clients/service";
import { confirmImport, initImport, processImport, publishImportDrafts, receiveFile } from "@/features/uploads/service";
import { createDraftReport, getReportData, getReportManifest, publishReport } from "@/features/reports/service";
import { getRepositories } from "@/server/repositories";
import { monthPeriod } from "@/lib/dates/period";
import type { ClientInput } from "@/features/clients/input";

const monthCtx = { granularity: "month" as const, requestedPeriod: null, clientNames: ["Lucas Ortodontia"] };

function book(rows: Array<Array<string | number | null>>, name = "Planilha1") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return readExcel(workbookBuffer(wb), "xlsx");
}

const data = (r: { periods: Array<{ data: unknown }> }, i = 0): TrafficData => TrafficDataSchema.parse(r.periods[i].data);

describe("dados colados", () => {
  it("cada tabela Markdown vira uma aba com o nome do título acima dela", () => {
    const sheets = readMarkdownTables(
      [
        "Resumo enviado pelo time:",
        "## Funil",
        "| Mês | Leads | **Vendas** |",
        "|:---|---:|---:|",
        "| 01/2026 | 120 | 8 |",
        "",
        "**Canais**",
        "Dados de janeiro:",
        "| Mês | Canal | Leads |",
        "| --- | --- | --- |",
        "| 01/2026 | Indicação \\| parceiros | 4 |",
        "",
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
      ].join("\n"),
      "Funil",
    );
    expect(sheets.map((s) => [s.name, s.untitled])).toEqual([
      ["Funil", false],
      ["Canais", false],
      ["Funil (2)", true],
    ]);
    expect(sheets[0].headers).toEqual(["Mês", "Leads", "Vendas"]);
    expect(sheets[0].rows[0].cells).toEqual({ Mês: "01/2026", Leads: "120", Vendas: "8" });
    // O número da linha é o do texto colado (para as mensagens de erro baterem com o campo).
    expect(sheets[0].rows[0].line).toBe(5);
    expect(sheets[1].rows[0].cells.Canal).toBe("Indicação | parceiros");
  });

  it("aceita tabela sem linha separadora e títulos numerados", () => {
    const sheets = readMarkdownTables(["## 2. Canais", "| Mês | Canal | Leads |", "| 01/2026 | Instagram | 90 |"].join("\n"), "Funil");
    expect(sheets.map((s) => s.name)).toEqual(["Canais"]);
    expect(sheets[0].rows[0].cells.Leads).toBe("90");
  });

  it("sem tabela Markdown, lê células copiadas da planilha (separadas por tabulação)", () => {
    const wb = readPastedData(Buffer.from("Mês\tInvestimento\tImpressões\n01/2026\t397,88\t27850\n"), "Campanhas");
    expect(wb.sheets[0].name).toBe("Campanhas");
    expect(wb.sheets[0].rows[0].cells.Investimento).toBe("397,88");
  });

  it("recusa texto sem tabela", () => {
    expect(() => readPastedData(Buffer.from("só um texto qualquer"), "Campanhas")).toThrow(/tabela/);
  });
});

describe("upload por plataforma", () => {
  it("tabela de totais por mês, sem colunas Plataforma e Campanha", () => {
    const issues = new IssueCollector();
    const wb = readPastedData(
      Buffer.from(["| Mês | Verba | Impressões | Contatos |", "|---|---|---|---|", "| jan/2026 | R$ 397,88 | 27.850 | 12 |", "| fev/2026 | R$ 602,86 | 42.200 | 54 |", "| **Total** | R$ 1.000,74 | 70.050 | 66 |"].join("\n")),
      "Campanhas",
    );
    const r = normalizeTraffic(wb, { ...monthCtx, platform: "meta_ads" }, issues);
    expect(issues.errors).toEqual([]);
    expect(r.periods.map((p) => p.periodKey)).toEqual(["2026-01", "2026-02"]);
    const jan = data(r);
    expect(jan.campaigns).toHaveLength(1);
    expect(jan.campaigns[0]).toMatchObject({ platform: "meta_ads", name: "Meta Ads", investment: 397.88, impressions: 27850, results: 12 });
    // O nome da coluna vira o rótulo do resultado no portal.
    expect(buildTrafficView(jan).totals.resultGroups[0].label).toBe("Contatos");
  });

  it("lê a exportação do Google Ads segmentada por mês", () => {
    const issues = new IssueCollector();
    const wb = book([
      ["Relatório de campanha"],
      ["1 de janeiro de 2026 - 31 de agosto de 2026"],
      ["Campanha", "Mês", "Código da moeda", "Custo", "Impr.", "Cliques", "CTR", "Conversões", "Custo/conv."],
      ["Pesquisa - Ortodontia", "janeiro de 2026", "BRL", "859,43", "9.012", "450", "4,99%", "37,00", "23,23"],
      ["Pesquisa - Ortodontia", "fevereiro de 2026", "BRL", "1.216,22", "11.034", "500", "4,53%", "46,00", "26,44"],
      ["Display", "fevereiro de 2026", "BRL", "0,00", "0", "0", "--", "0,00", "--"],
      ["Total: conta", "", "BRL", "2.075,65", "20.046", "950", "4,74%", "83,00", "25,01"],
    ]);
    const r = normalizeTraffic(wb, { ...monthCtx, platform: "google_ads" }, issues);
    expect(issues.errors).toEqual([]);
    expect(r.periods.map((p) => p.periodKey)).toEqual(["2026-01", "2026-02"]);
    const jan = data(r);
    expect(jan.campaigns[0]).toMatchObject({ platform: "google_ads", investment: 859.43, impressions: 9012, clicks: 450, results: 37, resultType: "conversion", conversions: 37 });
    expect(data(r, 1).campaigns).toHaveLength(2);
  });

  it("lê a exportação do Meta Ads dividida por mês (mês em curso conta como o mês)", () => {
    const issues = new IssueCollector();
    const wb = book([
      ["Início dos relatórios", "Término dos relatórios", "Nome da conta", "Nome da campanha", "Valor usado (BRL)", "Impressões", "Alcance", "Resultados", "Indicador de resultado", "Custo por resultado", "Contatos no site"],
      ["2026-07-01", "2026-07-31", "CA 01 - Clínica Sorriso", "Mensagens", 755.03, 52000, 30100, 73, "actions:onsite_conversion.messaging_conversation_started_7d", 10.34, 3],
      ["2026-08-01", "2026-08-25", "CA 01 - Clínica Sorriso", "Mensagens", 864.99, 60500, 34600, 92, "actions:onsite_conversion.messaging_conversation_started_7d", 9.4, 5],
    ]);
    const r = normalizeTraffic(wb, { ...monthCtx, platform: "meta_ads" }, issues);
    expect(issues.errors).toEqual([]);
    expect(r.periods.map((p) => p.period)).toEqual([monthPeriod(2026, 7), monthPeriod(2026, 8)]);
    expect(data(r, 1).campaigns[0]).toMatchObject({ investment: 864.99, results: 92, resultType: "whatsapp", reach: 34600 });
    // Conta de anúncios com outro nome: só um aviso.
    expect(issues.warnings.map((w) => w.code)).toContain("account_mismatch");
  });

  it("ignora linhas de outras plataformas e soma linhas repetidas da mesma campanha", () => {
    const issues = new IssueCollector();
    const wb = book(
      [
        ["Data", "Plataforma", "Campanha", "Investimento", "Impressões", "Resultados", "Tipo de resultado"],
        ["02/01/2026", "Meta", "Mensagens", 100, 5000, 3, "WhatsApp"],
        ["03/01/2026", "Meta", "Mensagens", 50, 2500, 2, "WhatsApp"],
        ["03/01/2026", "Google Ads", "Pesquisa", 80, 900, 4, "Conversões"],
      ],
      "Campanhas",
    );
    const r = normalizeTraffic(wb, { ...monthCtx, platform: "meta_ads" }, issues);
    expect(issues.errors).toEqual([]);
    expect(data(r).campaigns).toEqual([expect.objectContaining({ name: "Mensagens", investment: 150, impressions: 7500, results: 5 })]);
    expect(issues.warnings.map((w) => w.code)).toContain("other_platform_rows");
  });

  it("sem plataforma escolhida, a coluna Plataforma continua obrigatória", () => {
    const issues = new IssueCollector();
    normalizeTraffic(book([["Mês", "Campanha", "Investimento", "Impressões"], ["01/2026", "X", 10, 100]], "Campanhas"), monthCtx, issues);
    expect(issues.errors.map((e) => e.message).join(" ")).toMatch(/Plataforma/);
  });
});

describe("fluxo: colar dados de uma plataforma com vários meses", () => {
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

  it("mantém as outras plataformas de cada mês, cria um rascunho por mês e publica tudo de uma vez", async () => {
    const client = await createClient(input, null);
    // Janeiro já publicado com Meta + Google.
    const jan = TrafficDataSchema.parse({
      schemaVersion: 1,
      period: monthPeriod(2026, 1),
      campaigns: [
        { id: "meta-mensagens", platform: "meta_ads", name: "Mensagens", investment: 397.88, impressions: 27850, results: 12, resultType: "whatsapp" },
        { id: "google-antiga", platform: "google_ads", name: "Pesquisa antiga", investment: 500, impressions: 6000, results: 10, resultType: "conversion" },
      ],
    });
    const base = await createDraftReport({ clientId: client.id, type: "traffic", kind: "dataset", period: jan.period, source: null, data: { type: "traffic", data: jan } });
    await publishReport(client.id, base.id, null);

    const pasted = ["| Mês | Campanha | Custo | Impr. | Conversões |", "|---|---|---|---|---|", "| 01/2026 | Pesquisa | 859,43 | 9.012 | 37 |", "| 02/2026 | Pesquisa | 1.216,22 | 11.034 | 46 |"].join("\n");
    const body = Buffer.from(pasted);
    const init = await initImport({ clientId: client.id, reportType: "traffic", fileName: "dados-colados-google.md", size: body.length, contentType: "text/markdown", platform: "google_ads" });
    await receiveFile(init.importId, body);
    const record = await processImport(init.importId);
    expect(record.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(record.format).toBe("md");
    expect(record.preview?.suggestedPeriodKeys).toEqual(["2026-01", "2026-02"]);
    expect(record.preview?.periods[0].details.join(" ")).toMatch(/Mantém do relatório atual: Meta Ads/);

    const done = await confirmImport(record.id, { periodKeys: ["2026-01", "2026-02"] });
    expect(done.reportIds).toHaveLength(2);
    const janDraft = (await getReportManifest(client.id, done.reportIds[0]))!;
    const janData = await getReportData(janDraft);
    expect(janData?.type === "traffic" && janData.data.campaigns.map((c) => c.name)).toEqual(["Mensagens", "Pesquisa"]);
    expect(janDraft.summary["platform.google_ads.investment"]).toBeCloseTo(859.43, 6);
    expect(janDraft.source?.type).toBe("md");

    expect(await publishImportDrafts(record.id, null)).toBe(2);
    const index = await getRepositories().reports.getIndex(client.id);
    expect(index.reports.find((r) => r.id === base.id)?.status).toBe("superseded");
    expect(index.reports.filter((r) => r.status === "published").map((r) => r.periodKey).sort()).toEqual(["2026-01", "2026-02"]);
  });

  it("recusa plataforma em relatório comercial", async () => {
    const client = await createClient({ ...input, commercial: { ...input.commercial, enabled: true } }, null);
    await expect(initImport({ clientId: client.id, reportType: "commercial", fileName: "x.md", size: 10, contentType: "text/markdown", platform: "meta_ads" })).rejects.toThrow(/tráfego/);
  });
});
