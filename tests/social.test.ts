import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryStorage } from "./helpers/setup";
import { readExcel } from "@/lib/parsers/xlsx";
import { readPastedData } from "@/lib/parsers/markdown";
import { monthPeriod } from "@/lib/dates/period";
import { IssueCollector } from "@/features/uploads/issues";
import { socialTemplateWorkbook, workbookBuffer } from "@/features/uploads/templates";
import { pasteExample } from "@/features/uploads/components/format-guide";
import { matchClientSheet, normalizeSocial, selectClientSheet, type SocialNormalizeContext } from "@/features/social/normalize";
import { SocialDataSchema, type SocialData } from "@/features/social/schema";
import { computeSocialMetrics, socialSummary } from "@/features/social/metrics";
import { buildSocialViewModel } from "@/features/social/view-model";
import { buildSocialOverview } from "@/features/social/overview";
import { computeDelivery } from "@/features/reports/delivery";
import { createClient } from "@/features/clients/service";
import { confirmImport, initImport, processImport, publishImportDrafts, receiveFile } from "@/features/uploads/service";
import { getReportManifest } from "@/features/reports/service";
import { loadPortalModel } from "@/features/portal/model";
import type { ClientInput } from "@/features/clients/input";
import type { ReportIndexEntry } from "@/features/reports/schema";

type Row = Array<string | number | null>;

const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const HEADER_2026 = ["MÊS", "SEGUIDORES", "NOVOS SEGUIDORES", "PERDAS", "ALCANCE", "VISUALIZAÇÕES", "ENGAJAMENTO", "VISITAS", "INTERAÇÕES", "CURTIDAS", "COMENTÁRIOS", "COMPARTILHAMENTOS", "SALVOS", "TOQUES EM LINKS"];
const HEADER_2024 = ["MÊS", "SEGUIDORES", "NOVOS SEGUIDORES", "ALCANCE", "IMPRESSÕES", "ENGAJAMENTO", "VISITAS", "INTERAÇÕES", "CURTIDAS", "COMENTÁRIOS", "SALVOS", "COMPARTILHAMENTOS", "TOQUE NO SITE"];
const GLOSSARY: Row[] = [
  ["ALCANCE:", "O número de contas únicas que viram o seu conteúdo pelo menos uma vez, inclusive anúncios."],
  ["ENGAJAMENTO:", "O número de contas que interagiram com o seu conteúdo, inclusive anúncios."],
  ["TOQUE NO SITE", "O número de vezes que o link para o seu site foi tocado."],
];

/** Aba no formato da planilha da Look: título (B1), cabeçalho, 12 meses, observação e glossário. */
function clientTab(title: string, header: string[], filled: Record<string, Row>, note: string | null = null): XLSX.WorkSheet {
  const rows: Row[] = [[null, title], header, ...MONTHS.map((m) => [m, ...(filled[m] ?? [])]), ["OBSERVAÇÃO", note], [], ...GLOSSARY];
  return XLSX.utils.aoa_to_sheet(rows);
}

/** Valores no formato da aba CARDIOCENTER (Visitas vazio, como vem hoje do Instagram). */
const CARDIO: Record<string, Row> = {
  JULHO: [3561, 132, 37, 9335, 78040, 74, null, 103, 67, 4, 13, 5, 32],
  AGOSTO: [3623, 105, 44, 10985, 93971, 74, null, 141, 110, 4, 8, 7, 20],
  SETEMBRO: [3699, 99, 22, 7393, 32277, 141, null, 254, 186, 15, 20, 4, 13],
};

/** A planilha inteira: dezenas de abas (uma por cliente), inclusive abas antigas de 2024. */
function masterWorkbook(extraTabs = 34): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (let i = 0; i < extraTabs; i++) XLSX.utils.book_append_sheet(wb, clientTab("ANÁLISE DE DADOS - INSTAGRAM", HEADER_2026, { JANEIRO: [100 + i, 5, 1, 300, 900, 10, null, 20, 15, 1, 2, 2, 0] }), `CLIENTE ${String.fromCharCode(65 + (i % 26))}${i}`);
  XLSX.utils.book_append_sheet(wb, clientTab("ANÁLISE DE DADOS - INSTAGRAM - 2024", HEADER_2024, { SETEMBRO: [371, 18, 1014, 3355, 70, 99, 142, 124, 1, 5, 11, 1], OUTUBRO: [380, 14, 667, 3203, 90, 134, 227, 204, 3, 9, 6, 8] }, "Cadastrado no Mlabs em 21/08/24"), "CHAVES E MATOS ADV");
  XLSX.utils.book_append_sheet(wb, clientTab("ANÁLISE DE DADOS - INSTAGRAM - 2026", HEADER_2026, { JANEIRO: [1, 1, 0, 1, 1, 1, null, 1, 1, 0, 0, 0, 0] }), "GILVAN LANDIM");
  XLSX.utils.book_append_sheet(wb, clientTab("ANÁLISE DE DADOS - INSTAGRAM - 2026", HEADER_2026, { JANEIRO: [2, 1, 0, 1, 1, 1, null, 1, 1, 0, 0, 0, 0] }), "INSTITUTO LANDIM");
  XLSX.utils.book_append_sheet(wb, clientTab("ANÁLISE DE DADOS - INSTAGRAM - 2026", HEADER_2026, CARDIO, "Setembro só tem dados até dia 20"), "CARDIOCENTER");
  return wb;
}

const ctx = (clientNames: string[], extra: Partial<SocialNormalizeContext> = {}): SocialNormalizeContext => ({ requestedPeriod: null, clientNames, today: "2026-10-11", ...extra });
const social = (r: { periods: Array<{ data: unknown }> }, i = 0): SocialData => SocialDataSchema.parse(r.periods[i].data);

function read(wb: XLSX.WorkBook, clientNames: string[], extra: Partial<SocialNormalizeContext> = {}) {
  const issues = new IssueCollector();
  const workbook = readExcel(workbookBuffer(wb), "xlsx", { select: selectClientSheet(clientNames) });
  return { ...normalizeSocial(workbook, ctx(clientNames, extra), issues), issues, workbook };
}

describe("rede social: leitura da planilha da Look", () => {
  it("acha a aba do cliente numa planilha com mais de 30 abas e lê cada mês preenchido", () => {
    const r = read(masterWorkbook(), ["Cardiocenter", "Cardiocenter", "cardiocenter"]);
    expect(r.issues.errors).toEqual([]);
    expect(r.workbook.sheetNames).toHaveLength(38);
    expect(r.workbook.sheets.map((s) => s.name)).toEqual(["CARDIOCENTER"]);
    expect(r.periods.map((p) => p.periodKey)).toEqual(["2026-07", "2026-08", "2026-09"]);
    const sep = social(r, 2);
    expect(sep.network).toBe("instagram");
    expect(sep.metrics).toMatchObject({ followers: 3699, newFollowers: 99, lostFollowers: 22, reach: 7393, views: 32277, engagement: 141, profileVisits: null, interactions: 254, likes: 186, comments: 15, shares: 20, saves: 4, linkClicks: 13 });
    expect(sep.labels).toEqual({ views: "Visualizações", linkClicks: "Toques em links" });
    // Observação é interna: vira aviso para o ADM, nunca dado do cliente.
    expect(r.issues.warnings.find((w) => w.code === "sheet_note")?.message).toContain("Setembro só tem dados até dia 20");
  });

  it("aba antiga: ano do título (2024), Impressões e Toque no site mantêm o nome da planilha", () => {
    const r = read(masterWorkbook(3), ["Chaves e Matos Advogados", "Chaves e Matos", "chaves-e-matos"]);
    expect(r.issues.errors).toEqual([]);
    expect(r.periods.map((p) => p.periodKey)).toEqual(["2024-09", "2024-10"]);
    const s = social(r);
    expect(s.labels).toEqual({ views: "Impressões", linkClicks: "Toque no site" });
    expect(s.metrics.lostFollowers).toBeNull();
    expect(s.metrics.profileVisits).toBe(99);
  });

  it("encontra a aba pelo nome sem acento, caixa ou “Dra.”", () => {
    expect(matchClientSheet(["CARDIOCENTER", "ISABOR SANTANNA"], ["Dra. Isabor Sant'Anna", "Dra. Isabor", "isabor"])).toEqual({ kind: "match", name: "ISABOR SANTANNA" });
    expect(matchClientSheet(["HOSPITAL DA PLÁSTICA DA BAHIA", "INH"], ["Hospital da Plástica da Bahia"])).toEqual({ kind: "match", name: "HOSPITAL DA PLÁSTICA DA BAHIA" });
    expect(matchClientSheet(["LUANE MATOS ", "LUCAS FRAGA"], ["Luane Matos"])).toEqual({ kind: "match", name: "LUANE MATOS " });
    // Nome exato vence a coincidência parcial.
    expect(matchClientSheet(["GILVAN LANDIM", "INSTITUTO LANDIM"], ["Instituto Landim", "Landim"])).toEqual({ kind: "match", name: "INSTITUTO LANDIM" });
    expect(matchClientSheet(["GILVAN LANDIM", "INSTITUTO LANDIM"], ["Landim"])).toEqual({ kind: "ambiguous", names: ["GILVAN LANDIM", "INSTITUTO LANDIM"] });
    expect(matchClientSheet(["CARDIOCENTER"], ["Serenity Terapias", "Serenity"])).toEqual({ kind: "none" });
  });

  it("aba ambígua ou inexistente é erro com a lista das abas", () => {
    const ambiguous = read(masterWorkbook(2), ["Landim", "Landim", "landim"]);
    expect(ambiguous.periods).toEqual([]);
    expect(ambiguous.issues.errors[0]?.code).toBe("ambiguous_sheet");
    const missing = read(masterWorkbook(2), ["Serenity Terapias", "Serenity", "serenity"]);
    expect(missing.issues.errors[0]?.code).toBe("client_sheet_not_found");
    expect(missing.issues.errors[0]?.message).toContain("CARDIOCENTER");
  });

  it("aba única com nome de outro cliente: lê, mas avisa", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, clientTab("ANÁLISE DE DADOS - INSTAGRAM - 2026", HEADER_2026, CARDIO), "CARDIOCENTER");
    const r = read(wb, ["Serenity Terapias", "Serenity", "serenity"]);
    expect(r.issues.errors).toEqual([]);
    expect(r.periods).toHaveLength(3);
    expect(r.issues.warnings.map((w) => w.code)).toContain("sheet_name_mismatch");
  });

  it("sem ano: vale o ano atual — ou o anterior, quando há meses depois do mês atual", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, clientTab("ANÁLISE DE DADOS - INSTAGRAM", HEADER_2026, { ...CARDIO, DEZEMBRO: [3800, 50, 10, 5000, 9000, 40, null, 90, 70, 5, 5, 5, 5] }), "CARDIOCENTER");
    const january = read(wb, ["Cardiocenter"], { today: "2027-01-08" });
    expect(january.periods.map((p) => p.periodKey)).toEqual(["2026-07", "2026-08", "2026-09", "2026-12"]);
    expect(january.issues.warnings.map((w) => w.code)).toContain("year_assumed");

    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, clientTab("ANÁLISE DE DADOS - INSTAGRAM", HEADER_2026, CARDIO), "CARDIOCENTER");
    const october = read(wb2, ["Cardiocenter"]);
    expect(october.periods.map((p) => p.periodKey)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(october.issues.warnings.map((w) => w.code)).not.toContain("year_assumed");
    // O mês escolhido no assistente define o ano quando a planilha não diz.
    expect(read(wb2, ["Cardiocenter"], { requestedPeriod: monthPeriod(2025, 8) }).periods[0].periodKey).toBe("2025-07");
  });

  it("número inválido, mês repetido e mês ilegível com números são erros; o glossário é ignorado", () => {
    const wb = XLSX.utils.book_new();
    const rows: Row[] = [[null, "ANÁLISE DE DADOS - INSTAGRAM - 2026"], HEADER_2026, ["JULHO", 3561, "muitos", 37, 9335], ["AGOSTO", 3623, 105, 44, 10985], ["agosto", 3630, 1, 1, 1], ["SETEMBRUS", 3699, 99], ...GLOSSARY];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "CARDIOCENTER");
    const r = read(wb, ["Cardiocenter"]);
    expect(r.issues.errors.map((e) => e.code).sort()).toEqual(["duplicate_period", "invalid_number", "invalid_period"]);
  });

  it("perdas com sinal negativo viram a mesma contagem; colunas de taxa não são lidas; colunas novas aparecem como vieram", () => {
    const pasted = ["## Rede social", "| Mês | Seguidores | Perdas | Alcance | Engajamento | Taxa de engajamento | Publicações |", "|---|---|---|---|---|---|---|", "| 08/2026 | 1.271 | -17 | 14.556 | 144 | 0,99% | 12 |"].join("\n");
    const issues = new IssueCollector();
    const r = normalizeSocial(readPastedData(Buffer.from(pasted), "Rede social"), ctx(["Clínica Teste"]), issues);
    expect(issues.errors).toEqual([]);
    const s = social(r);
    expect(s.period).toEqual(monthPeriod(2026, 8));
    expect(s.metrics.lostFollowers).toBe(17);
    expect(s.extraMetrics).toEqual([{ key: "publicacoes", label: "Publicações", value: 12 }]);
    expect(computeSocialMetrics(s).values.engagementRate).toBeCloseTo(144 / 14556, 6);
  });

  it("o modelo XLSX e o exemplo do assistente passam na validação", () => {
    const template = read(socialTemplateWorkbook(), ["Clínica Exemplo"]);
    expect(template.issues.errors).toEqual([]);
    expect(template.periods.map((p) => p.periodKey)).toEqual(["2026-07", "2026-08", "2026-09"]);
    const issues = new IssueCollector();
    const pasted = normalizeSocial(readPastedData(Buffer.from(pasteExample("social", "monthly", null)), "Rede social"), ctx(["Clínica Teste"], { requestedPeriod: monthPeriod(2026, 9) }), issues);
    expect(issues.errors).toEqual([]);
    expect(pasted.periods.map((p) => p.periodKey)).toEqual(["2026-08", "2026-09"]);
  });
});

describe("rede social: cálculos e telas", () => {
  const data = (m: number, metrics: Partial<SocialData["metrics"]>): SocialData => SocialDataSchema.parse({ schemaVersion: 1, period: monthPeriod(2026, m), metrics, labels: { views: "Visualizações" } });
  const entry = (d: SocialData): ReportIndexEntry => {
    const { summary, labels } = socialSummary(d);
    return { id: `rp_${d.period.start}`, type: "social", kind: "dataset", period: d.period, periodKey: d.period.start.slice(0, 7), title: null, status: "published", summary, labels, allowDownload: false, retroactive: false, updatedAt: "2026-10-01T00:00:00.000Z", publishedAt: "2026-10-01T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z", sourceType: "xlsx", sourceFileName: null, insightCount: 0 };
  };
  const aug = data(8, { followers: 3623, newFollowers: 105, lostFollowers: 44, reach: 10985, views: 93971, engagement: 74, interactions: 141, likes: 110, comments: 4, shares: 8, saves: 7, linkClicks: 20 });
  const sep = data(9, { followers: 3699, newFollowers: 99, lostFollowers: 22, reach: 7393, views: 32277, engagement: 141, interactions: 254, likes: 186, comments: 15, shares: 20, saves: 4, linkClicks: 13 });

  it("saldo, taxa de engajamento e composição das interações (com “outras”)", () => {
    const m = computeSocialMetrics(sep);
    expect(m.values.netFollowers).toBe(77);
    expect(m.values.engagementRate).toBeCloseTo(141 / 7393, 6);
    expect(m.interactionSlices.map((s) => [s.key, s.value])).toEqual([["likes", 186], ["comments", 15], ["saves", 4], ["shares", 20], ["other", 29]]);
    expect(m.interactionSlices[0].share).toBeCloseTo(186 / 254, 6);
  });

  it("relatório do mês: destaques, comparação com o mês anterior e crescimento de seguidores", () => {
    const vm = buildSocialViewModel(sep, { previous: entry(aug), history: [entry(aug), entry(sep)] });
    expect(vm.kpis.map((k) => k.key)).toEqual(["followers", "reach", "views", "engagement"]);
    expect(vm.kpis[0].footnote).toBe("+99 novos · 22 deixaram de seguir");
    expect(vm.kpis[1].comparison?.trend).toBe("down");
    expect(vm.secondary.map((k) => k.key)).toEqual(["newFollowers", "lostFollowers", "engagementRate", "interactions", "linkClicks"]);
    // Perder menos seguidores é bom.
    expect(vm.secondary[1].comparison?.sentiment).toBe("positive");
    expect(vm.audience?.growth).toBeCloseTo(76 / 3623, 6);
    expect(vm.headline).toBe("Setembro de 2026: 3.699 seguidores (saldo de +77), 7.393 contas alcançadas e 254 interações. O alcance caiu 32,7% em relação a agosto.");
    expect(vm.trend?.series.map((s) => s.key)).toContain("followers");
    expect(vm.glossary.find((g) => g.key === "reach")?.description).toMatch(/contas únicas/i);
  });

  it("visão geral: seguidores do último mês, contagens somadas e alcance em média (nunca somado)", () => {
    const vm = buildSocialOverview([entry(aug), entry(sep)]);
    const value = (key: string) => [...vm.kpis, ...vm.secondary].find((k) => k.key === key)?.value;
    expect(value("followers")).toBe(3699);
    expect(value("newFollowers")).toBe(204);
    expect(value("reach")).toBe((10985 + 7393) / 2);
    expect(value("interactions")).toBe(395);
    expect(vm.kpis[0].footnote).toBe("+76 desde agosto (+2,1%)");
    expect(vm.table.total?.followers).toBeNull();
    expect(vm.table.total?.reach).toBeNull();
    expect(vm.table.total?.views).toBe(93971 + 32277);
    expect(vm.interactionSeries?.map((s) => s.key)).toEqual(["likes", "comments", "saves", "shares"]);
    expect(vm.headline).toBe("Agosto a setembro de 2026: o perfil passou de 3.623 para 3.699 seguidores (+76), somou 395 interações e alcançou, em média, 9.189 contas por mês.");
  });

  it("prazo: o relatório do mês vence no dia escolhido do mês seguinte", () => {
    const socialModule = { enabled: true, cadence: "monthly" as const, dueDay: 5, allowOriginalDownload: false };
    const d = computeDelivery({ module: socialModule, reports: [], today: "2026-10-11" });
    expect(d.expectedPeriod).toEqual(monthPeriod(2026, 9));
    expect(d.state).toBe("pending");
  });
});

describe("fluxo: rede social no portal", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  const baseInput: ClientInput = {
    name: "Cardiocenter",
    shortName: "Cardiocenter",
    slug: "cardiocenter",
    greetingName: "",
    segment: "",
    currency: "BRL",
    notes: "",
    roiMetric: "roas",
    commercial: { enabled: false, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
    traffic: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
  };

  it("planilha com todas as abas → rascunhos por mês → publicar → aba Rede social com visão geral", async () => {
    const client = await createClient({ ...baseInput, social: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: false } }, null);
    expect(client.modules.social.enabled).toBe(true);
    const body = workbookBuffer(masterWorkbook());
    const init = await initImport({ clientId: client.id, reportType: "social", fileName: "rede-social.xlsx", size: body.length, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    await receiveFile(init.importId, body);
    const record = await processImport(init.importId);
    expect(record.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(record.preview?.sheets).toEqual([{ name: "CARDIOCENTER", rows: 16, recognizedAs: "Rede social · Instagram" }]);
    expect(record.preview?.suggestedPeriodKeys).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(record.preview?.periods[2].metrics[0]).toEqual({ label: "Seguidores", value: "3.699" });

    const done = await confirmImport(record.id, { periodKeys: record.preview!.suggestedPeriodKeys });
    expect(await publishImportDrafts(done.id, null)).toBe(3);
    // "Sem período anterior" fica só no relatório do primeiro mês, não nos três.
    const [july, , sept] = await Promise.all(done.reportIds.map((id) => getReportManifest(client.id, id)));
    expect(july?.warnings.map((w) => w.code)).toContain("no_previous");
    expect(sept?.warnings.map((w) => w.code)).not.toContain("no_previous");
    expect(sept?.warnings.map((w) => w.code)).toContain("sheet_note");

    const model = await loadPortalModel(client, { tab: "rede-social", mode: "client" });
    expect(model.tabs).toEqual(["traffic", "social"]);
    expect(model.tab).toBe("social");
    expect(model.view).toBe("overview");
    expect(model.overview?.map((e) => e.periodKey)).toEqual(["2026-07", "2026-08", "2026-09"]);

    const september = await loadPortalModel(client, { tab: "rede-social", period: "2026-09", mode: "client" });
    expect(september.selection.dataset?.data.type).toBe("social");
    expect(september.previous?.periodKey).toBe("2026-08");
  });

  it("clientes antigos entram com o módulo desativado e o upload é recusado", async () => {
    const client = await createClient(baseInput, null);
    expect(client.modules.social.enabled).toBe(false);
    await expect(initImport({ clientId: client.id, reportType: "social", fileName: "x.xlsx", size: 10, contentType: "" })).rejects.toThrow(/Rede social/);
  });
});
