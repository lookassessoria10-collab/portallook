import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { useMemoryStorage } from "./helpers/setup";
import { createClient, getClient } from "@/features/clients/service";
import type { ClientInput } from "@/features/clients/input";
import { createDraftReport, getReportData, getReportManifest, publishReport } from "@/features/reports/service";
import { getRepositories } from "@/server/repositories";
import { loadPortalModel } from "@/features/portal/model";
import { SocialDataSchema } from "@/features/social/schema";
import { monthPeriod } from "@/lib/dates/period";
import { clearSheetMemoryForTesting, getSocialSheetState, refreshSocialSheetIfStale, SHEET_SYNC_ACTOR, syncSocialSheet } from "@/features/social/sheet-sync";

const NOW = new Date("2026-11-09T15:00:00Z");
const HEADER = ["MÊS", "SEGUIDORES", "NOVOS SEGUIDORES", "PERDAS", "ALCANCE", "VISUALIZAÇÕES", "ENGAJAMENTO", "VISITAS", "INTERAÇÕES", "CURTIDAS", "COMENTÁRIOS", "COMPARTILHAMENTOS", "SALVOS", "TOQUES EM LINKS"];
const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

/** Cardiocenter real (jan a out de 2026). */
const CARDIO: Array<Array<number | null>> = [
  [3269, 92, 36, 90057, 153117, 214, null, 322, 263, 12, 15, 9, 35],
  [3310, 76, 34, 80071, 140680, 302, null, 477, 333, 58, 36, 1, 22],
  [3350, 84, 43, 3145, 10552, 104, null, 178, 110, 4, 25, 9, 28],
  [3403, 95, 43, 3094, 18633, 139, null, 257, 228, 25, 38, 5, 18],
  [3434, 91, 59, 5340, 19018, 179, null, 326, 252, 20, 21, 6, 20],
  [3466, 69, 38, 2325, 9621, 39, null, 71, 58, 2, 4, 3, 18],
  [3561, 132, 37, 9335, 78040, 74, null, 103, 67, 4, 13, 5, 32],
  [3623, 105, 44, 10985, 93971, 74, null, 141, 110, 4, 8, 7, 20],
  [3699, 99, 22, 7393, 32277, 141, null, 254, 186, 15, 20, 4, 13],
  [3756, 114, 57, 8240, 36638, 81, null, 152, 128, 5, 8, 4, 20],
];

/** Aba no formato da planilha da Look: título, cabeçalho, 12 meses, observação e glossário. */
function tab(rows: Array<Array<number | string | null>>): unknown[][] {
  return [
    [null, "ANÁLISE DE DADOS - INSTAGRAM"],
    HEADER,
    ...MONTHS.map((m, i) => [m, ...(rows[i] ?? HEADER.slice(1).map(() => null))]),
    ["OBSERVAÇÃO"],
    ["ALCANCE:", "O número de contas únicas que viram o conteúdo."],
  ];
}

function workbook(tabs: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(tabs)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const moduleOn = { enabled: true, cadence: "monthly" as const, dueDay: 5, allowOriginalDownload: false };
const input = (name: string, slug: string, social = true): ClientInput => ({
  name,
  shortName: name,
  slug,
  greetingName: "",
  segment: "",
  currency: "BRL",
  notes: "",
  roiMetric: "roas",
  commercial: moduleOn,
  traffic: moduleOn,
  social: { ...moduleOn, enabled: social },
});

/** Meses já no portal, publicados pelo upload (com os mesmos números da planilha, salvo `override`). */
async function publishMonths(clientId: string, months: number[], override: Record<number, Partial<Record<string, number>>> = {}) {
  for (const m of months) {
    const [followers, newFollowers, lostFollowers, reach, views, engagement, profileVisits, interactions, likes, comments, shares, saves, linkClicks] = CARDIO[m - 1];
    const metrics = { followers, newFollowers, lostFollowers, reach, views, engagement, profileVisits, interactions, likes, comments, shares, saves, linkClicks, ...override[m] };
    const data = SocialDataSchema.parse({ schemaVersion: 1, period: monthPeriod(2026, m), network: "instagram", metrics, labels: { views: "Visualizações", linkClicks: "Toques em links" } });
    const draft = await createDraftReport({ clientId, type: "social", kind: "dataset", period: data.period, source: null, data: { type: "social", data }, insights: [{ id: `in_${m}`, type: "neutral", title: "Leitura da Look", description: "Texto do mês.", tag: null, source: "manual" }] });
    await publishReport(clientId, draft.id, "adm@look");
  }
}

const socialEntries = async (clientId: string) => (await getRepositories().reports.getIndex(clientId)).reports.filter((r) => r.type === "social");

describe("rede social: sincronização com a planilha Google", () => {
  let fetchCalls: string[];
  let sheet: Buffer | string;
  let status: number;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    useMemoryStorage();
    clearSheetMemoryForTesting();
    fetchCalls = [];
    status = 200;
    sheet = workbook({ "A VIA DA CONSCIÊNCIA": tab(CARDIO), CARDIOCENTER: tab(CARDIO), SERENITY: tab(CARDIO.slice(0, 9)), "CLIENTE ANTIGO": tab(CARDIO) });
    vi.stubGlobal("fetch", async (url: URL | string) => {
      fetchCalls.push(String(url));
      const body = typeof sheet === "string" ? sheet : new Uint8Array(sheet);
      return new Response(body, { status, headers: { "content-type": typeof sheet === "string" ? "text/html" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    });
  });

  it("publica só o mês que falta (outubro) e não toca nos meses já publicados", async () => {
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    await publishMonths(cardio.id, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const before = (await socialEntries(cardio.id)).map((e) => ({ id: e.id, status: e.status, updatedAt: e.updatedAt }));

    const result = await syncSocialSheet({ force: true });
    expect(result.error).toBeNull();
    expect(result.created[cardio.id]).toEqual(["2026-10"]);
    expect(fetchCalls[0]).toBe("https://docs.google.com/spreadsheets/d/1fmFc-tPSSE0SLeBXPeg5Mrrfp6FarmbN8Wiq6357NUI/export?format=xlsx");

    const entries = await socialEntries(cardio.id);
    // Os 9 meses anteriores continuam exatamente como estavam.
    for (const b of before) expect(entries.find((e) => e.id === b.id)).toMatchObject(b);
    const oct = entries.find((e) => e.periodKey === "2026-10")!;
    expect(oct.status).toBe("published");
    expect(oct.summary).toMatchObject({ followers: 3756, newFollowers: 114, lostFollowers: 57, reach: 8240, views: 36638, engagement: 81, interactions: 152, linkClicks: 20, profileVisits: null });
    const manifest = (await getReportManifest(cardio.id, oct.id))!;
    expect(manifest.source).toMatchObject({ type: "xlsx", path: null });
    const data = await getReportData(manifest);
    expect(data?.type === "social" && data.data.labels).toEqual({ views: "Visualizações", linkClicks: "Toques em links" });
    // Novembro está vazio na planilha e dezembro também: nada é criado.
    expect(entries.map((e) => e.periodKey).sort()).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);

    // O portal já mostra outubro na visão geral, com o layout de sempre.
    const model = await loadPortalModel((await getClient(cardio.id))!, { tab: "rede-social", mode: "client" });
    expect(model.view).toBe("overview");
    expect(model.overview?.map((e) => e.periodKey).at(-1)).toBe("2026-10");
  });

  it("rodar de novo não duplica nada", async () => {
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    await publishMonths(cardio.id, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    await syncSocialSheet({ force: true });
    const again = await syncSocialSheet({ force: true });
    expect(again.created[cardio.id]).toBeUndefined();
    expect((await socialEntries(cardio.id)).filter((e) => e.periodKey === "2026-10")).toHaveLength(1);
    const state = await getSocialSheetState();
    expect(state.clients[cardio.id].created.map((c) => c.periodKey)).toEqual(["2026-10"]);
  });

  it("cliente sem nenhum mês no portal recebe todos os meses encerrados", async () => {
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    const result = await syncSocialSheet({ force: true });
    expect(result.created[cardio.id]).toHaveLength(10);
    expect((await socialEntries(cardio.id)).every((e) => e.status === "published")).toBe(true);
  });

  it("mês publicado diferente da planilha não é alterado; a diferença aparece para o ADM", async () => {
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    await publishMonths(cardio.id, [1, 2, 3, 4, 5, 6, 7, 8, 9], { 9: { followers: 3700 } });
    const sep = (await socialEntries(cardio.id)).find((e) => e.periodKey === "2026-09")!;
    await syncSocialSheet({ force: true });
    const after = (await socialEntries(cardio.id)).find((e) => e.id === sep.id)!;
    expect(after.summary.followers).toBe(3700);
    expect(after.status).toBe("published");
    expect((await getReportManifest(cardio.id, sep.id))!.insights).toHaveLength(1);
    const state = await getSocialSheetState();
    expect(state.clients[cardio.id].divergent).toEqual([{ periodKey: "2026-09", fields: [{ key: "followers", label: "Seguidores", portal: 3700, sheet: 3699 }] }]);
  });

  it("rascunho, retirado ou arquivado do mês conta como existente", async () => {
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    const data = SocialDataSchema.parse({ schemaVersion: 1, period: monthPeriod(2026, 10), metrics: { followers: 1 } });
    await createDraftReport({ clientId: cardio.id, type: "social", kind: "dataset", period: data.period, source: null, data: { type: "social", data } });
    const result = await syncSocialSheet({ force: true });
    expect(result.created[cardio.id]).not.toContain("2026-10");
    expect((await socialEntries(cardio.id)).filter((e) => e.periodKey === "2026-10").map((e) => e.status)).toEqual(["draft"]);
  });

  it("o mês corrente nunca entra (ainda está mudando)", async () => {
    sheet = workbook({ CARDIOCENTER: tab([...CARDIO, [3800, 50, 6, 4000, 9000, 30, null, 60, 50, 5, 3, 2, 4]]) });
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    await publishMonths(cardio.id, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const result = await syncSocialSheet({ force: true });
    expect(result.created[cardio.id]).toBeUndefined();
    expect((await socialEntries(cardio.id)).some((e) => e.periodKey === "2026-11")).toBe(false);
  });

  it("ignora clientes sem Rede social, sem aba e as abas de clientes antigos", async () => {
    const serenity = await createClient(input("Serenity", "serenity-terapias", false), null);
    const semAba = await createClient(input("Clínica Nova", "clinica-nova"), null);
    const result = await syncSocialSheet({ force: true });
    expect(await socialEntries(serenity.id)).toHaveLength(0);
    expect(await socialEntries(semAba.id)).toHaveLength(0);
    expect(result.clients[serenity.id]).toBeUndefined();
    expect(result.clients[semAba.id].problem).toMatch(/não tem uma aba/);
  });

  it("aba com erro de leitura: nada é criado para o cliente", async () => {
    const broken = CARDIO.map((r) => [...r]) as Array<Array<number | string | null>>;
    broken[9][0] = "três mil";
    sheet = workbook({ CARDIOCENTER: tab(broken) });
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    const result = await syncSocialSheet({ force: true });
    expect(await socialEntries(cardio.id)).toHaveLength(0);
    expect(result.clients[cardio.id].problem).toMatch(/erro de leitura/);
  });

  it("planilha que deixou de ser pública (página de login): erro claro e nada muda", async () => {
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    await publishMonths(cardio.id, [1, 2]);
    sheet = "<!doctype html><title>Login</title>";
    const result = await syncSocialSheet({ force: true });
    expect(result.error).toMatch(/compartilhada/);
    expect(await socialEntries(cardio.id)).toHaveLength(2);
    const state = await getSocialSheetState();
    expect(state.error).toMatch(/compartilhada/);
    expect(state.checkedAt).toBeNull();
  });

  it("portal: lê no máximo a cada 10 minutos", async () => {
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    await refreshSocialSheetIfStale({ waitMs: 5000 });
    expect(fetchCalls).toHaveLength(1);
    expect(await socialEntries(cardio.id)).toHaveLength(10);

    vi.setSystemTime(new Date(NOW.getTime() + 5 * 60_000));
    await refreshSocialSheetIfStale({ waitMs: 5000 });
    expect(fetchCalls).toHaveLength(1);

    vi.setSystemTime(new Date(NOW.getTime() + 11 * 60_000));
    clearSheetMemoryForTesting();
    await refreshSocialSheetIfStale({ waitMs: 5000 });
    expect(fetchCalls).toHaveLength(2);
  });

  it("depois de uma falha, espera 2 minutos antes de tentar de novo", async () => {
    status = 500;
    await refreshSocialSheetIfStale({ waitMs: 5000 });
    expect(fetchCalls).toHaveLength(1);
    expect((await getSocialSheetState()).error).toMatch(/500/);
    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    await refreshSocialSheetIfStale({ waitMs: 5000 });
    expect(fetchCalls).toHaveLength(1);
    vi.setSystemTime(new Date(NOW.getTime() + 3 * 60_000));
    status = 200;
    await refreshSocialSheetIfStale({ waitMs: 5000 });
    expect(fetchCalls).toHaveLength(2);
    expect((await getSocialSheetState()).error).toBeNull();
  });

  it("publicações da sincronização ficam no log com o autor da planilha", async () => {
    const cardio = await createClient(input("Cardiocenter", "cardio-center"), null);
    await publishMonths(cardio.id, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    await syncSocialSheet({ force: true });
    const events = await getRepositories().events.listRecent({ clientId: cardio.id, limit: 50 });
    expect(events.some((e) => e.type === "report.published" && e.actor === SHEET_SYNC_ACTOR)).toBe(true);
  });
});
