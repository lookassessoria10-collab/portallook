import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryStorage } from "./helpers/setup";
import { monthPeriod, periodKey, weekPeriod, type Period } from "@/lib/dates/period";
import { createClient } from "@/features/clients/service";
import { createDraftReport, publishReport } from "@/features/reports/service";
import { TrafficDataSchema } from "@/features/traffic/schema";
import { loadPortalModel } from "@/features/portal/model";
import { deletePeriodNote, savePeriodNote } from "@/features/period-notes/service";
import { notePresetsFor } from "@/features/period-notes/schema";
import { periodOptions } from "@/features/uploads/period-options";
import { getRepositories } from "@/server/repositories";
import type { ClientInput } from "@/features/clients/input";

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

async function publishTraffic(clientId: string, period: Period) {
  const data = TrafficDataSchema.parse({ schemaVersion: 1, period, campaigns: [{ id: "x", platform: "meta_ads", name: "Campanha", investment: 100, impressions: 1000 }] });
  const report = await createDraftReport({ clientId, type: "traffic", kind: "dataset", period, source: null, data: { type: "traffic", data } });
  await publishReport(clientId, report.id, null);
}

const reload = async (id: string) => (await getRepositories().clients.get(id))!;

describe("justificativas de meses", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  it("salva uma por área e mês, substitui ao trocar o mês e remove", async () => {
    const client = await createClient(baseInput, null);
    await savePeriodNote(client.id, { type: "traffic", periodKey: "2026-09", status: "no_data", text: "Campanhas pausadas." }, null);
    await savePeriodNote(client.id, { type: "traffic", periodKey: "2026-09", status: "partial", text: "Só metade do mês." }, null);
    expect((await reload(client.id)).periodNotes.map((n) => [n.periodKey, n.status])).toEqual([["2026-09", "partial"]]);

    // Edição que troca o mês: a do mês antigo sai.
    await savePeriodNote(client.id, { type: "traffic", periodKey: "2026-10", status: "partial", text: "Só metade do mês.", replaceKey: "2026-09" }, null);
    expect((await reload(client.id)).periodNotes.map((n) => n.periodKey)).toEqual(["2026-10"]);

    await deletePeriodNote(client.id, "traffic", "2026-10", null);
    expect((await reload(client.id)).periodNotes).toEqual([]);
    await expect(deletePeriodNote(client.id, "traffic", "2026-10", null)).rejects.toThrow(/não encontrada/);
  });

  it("recusa justificativa de módulo desativado e mês inválido", async () => {
    const client = await createClient(baseInput, null);
    await expect(savePeriodNote(client.id, { type: "commercial", periodKey: "2026-09", status: "no_data", text: "x" }, null)).rejects.toThrow(/Comercial/);
    await expect(savePeriodNote(client.id, { type: "traffic", periodKey: "2026-13", status: "no_data", text: "x" }, null)).rejects.toThrow();
    await expect(savePeriodNote(client.id, { type: "traffic", periodKey: "2026-09", status: "no_data", text: "   " }, null)).rejects.toThrow();
  });

  it("portal mensal: mês sem dados vira aba só com a justificativa; dados incompletos vira aviso", async () => {
    const created = await createClient(baseInput, null);
    for (const m of [7, 8, 9]) await publishTraffic(created.id, monthPeriod(2026, m));
    await savePeriodNote(created.id, { type: "traffic", periodKey: "2026-10", status: "no_data", text: "Campanhas pausadas em outubro." }, null);
    await savePeriodNote(created.id, { type: "traffic", periodKey: "2026-08", status: "partial", text: "Google Ads ficou de fora." }, null);
    const client = await reload(created.id);

    const overview = await loadPortalModel(client, { tab: "trafego", mode: "client" });
    expect(overview.view).toBe("overview");
    expect(overview.periods.map((p) => [p.key, p.note])).toEqual([
      ["2026-07", null],
      ["2026-08", "partial"],
      ["2026-09", null],
      ["2026-10", "no_data"],
    ]);
    expect(overview.overview?.map((e) => e.periodKey)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(overview.notices.map((n) => n.key)).toEqual(["2026-10", "2026-08"]);
    expect(overview.missing).toBeNull();

    const october = await loadPortalModel(client, { tab: "trafego", period: "2026-10", mode: "client" });
    expect(october.view).toBe("period");
    expect(october.periodKey).toBe("2026-10");
    expect(october.selection.dataset).toBeNull();
    expect(october.missing).toEqual({ key: "2026-10", label: "Outubro de 2026", status: "no_data", text: "Campanhas pausadas em outubro." });
    expect(october.notices).toEqual([]);

    const august = await loadPortalModel(client, { tab: "trafego", period: "2026-08", mode: "client" });
    expect(august.selection.dataset?.entry.periodKey).toBe("2026-08");
    expect(august.missing).toBeNull();
    expect(august.notices.map((n) => [n.key, n.status])).toEqual([["2026-08", "partial"]]);

    // Mês pedido sem justificativa: nenhum aviso (os mais novos só aparecem na abertura padrão).
    const july = await loadPortalModel(client, { tab: "trafego", period: "2026-07", mode: "client" });
    expect(july.notices).toEqual([]);
  });

  it("áreas sem visão geral abrem o último mês com dados e avisam dos meses mais novos sem dados", async () => {
    const created = await createClient({ ...baseInput, traffic: { ...baseInput.traffic, enabled: false }, media_plan: { enabled: true, cadence: "monthly", dueDay: 1, allowOriginalDownload: false } }, null);
    await savePeriodNote(created.id, { type: "media_plan", periodKey: "2025-12", status: "no_data", text: notePresetsFor("media_plan", "no_data").at(-1)!.text }, null);
    const client = await reload(created.id);

    // Só justificativa, nenhum relatório: o mês aparece e abre direto.
    const model = await loadPortalModel(client, { tab: "plano-de-midia", mode: "client" });
    expect(model.periods.map((p) => p.key)).toEqual(["2025-12"]);
    expect(model.missing?.text).toMatch(/mídia paga/);
  });

  it("portal semanal: a justificativa do mês aparece nas semanas daquele mês", async () => {
    const created = await createClient({ ...baseInput, traffic: { ...baseInput.traffic, cadence: "weekly", dueDay: 2 } }, null);
    const week = weekPeriod("2026-09-21");
    await publishTraffic(created.id, week);
    await savePeriodNote(created.id, { type: "traffic", periodKey: "2026-09", status: "partial", text: "Conta bloqueada por 3 dias." }, null);
    await savePeriodNote(created.id, { type: "traffic", periodKey: "2026-10", status: "no_data", text: "Sem campanhas." }, null);
    const client = await reload(created.id);

    const model = await loadPortalModel(client, { tab: "trafego", mode: "client" });
    expect(model.scale).toBe("week");
    expect(model.scales).toBeNull();
    expect(model.periods.map((p) => p.key)).toEqual([periodKey(week)]);
    // Abertura padrão: a semana (setembro) e o mês mais novo sem dados.
    expect(model.notices.map((n) => n.key)).toEqual(["2026-10", "2026-09"]);
  });

  it("assistente oferece de janeiro de dois anos atrás até o mês corrente", () => {
    const months = periodOptions("monthly", "2026-11-06");
    expect(months[0].key).toBe("2026-11");
    expect(months.at(-1)?.key).toBe("2024-01");
    expect(months).toHaveLength(35);
    expect(periodOptions("monthly", "2026-11-06", undefined, 3)[0].key).toBe("2027-02");
    expect(periodOptions("weekly", "2026-11-06")).toHaveLength(16);
  });
});
