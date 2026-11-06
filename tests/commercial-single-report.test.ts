import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryStorage } from "./helpers/setup";
import { monthPeriod } from "@/lib/dates/period";
import { createClient } from "@/features/clients/service";
import { createDraftReport, publishReport } from "@/features/reports/service";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { loadPortalModel } from "@/features/portal/model";
import { savePeriodNote } from "@/features/period-notes/service";
import { getRepositories } from "@/server/repositories";
import type { ClientInput } from "@/features/clients/input";

const baseInput: ClientInput = {
  name: "Instituto Teste",
  shortName: "Instituto",
  slug: "instituto-teste",
  greetingName: "",
  segment: "",
  currency: "BRL",
  notes: "",
  roiMetric: "roas",
  commercial: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
  traffic: { enabled: false, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
};

async function html(clientId: string, month: number, title: string) {
  const r = await createDraftReport({
    clientId,
    type: "commercial",
    kind: "document",
    period: monthPeriod(2026, month),
    title,
    source: { type: "html_legacy", fileName: `${title}.html`, size: 10, contentType: "text/html" },
    original: { body: Buffer.from(`<html><body>${title}</body></html>`) },
    originalExtension: "html",
  });
  await publishReport(clientId, r.id, null);
  return r;
}

async function sheet(clientId: string, month: number) {
  const data = CommercialDataSchema.parse({
    schemaVersion: 1,
    period: monthPeriod(2026, month),
    funnel: [
      { key: "leads", label: "Leads", order: 1, value: 100 },
      { key: "vendas", label: "Vendas", order: 2, value: 10 },
    ],
  });
  const r = await createDraftReport({ clientId, type: "commercial", kind: "dataset", period: data.period, source: null, data: { type: "commercial", data } });
  await publishReport(clientId, r.id, null);
  return r;
}

const reload = async (id: string) => (await getRepositories().clients.get(id))!;

describe("comercial: um relatório só, o último HTML enviado", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  it("abre o HTML do mês mais recente e ignora o mês pedido na URL", async () => {
    const client = await createClient(baseInput, null);
    for (const m of [7, 8, 9]) await html(client.id, m, `Dashboard ${m}`);
    const october = await html(client.id, 10, "Dashboard 10");

    const model = await loadPortalModel(client, { tab: "comercial", mode: "client" });
    expect(model.singleReport).toBe(true);
    expect(model.periodKey).toBe("2026-10");
    expect(model.years).toBeNull();
    expect(model.scales).toBeNull();
    expect(model.selection.documents.map((d) => d.id)).toEqual([october.id]);

    // Links antigos com ?periodo= continuam abrindo o relatório atual.
    const old = await loadPortalModel(client, { tab: "comercial", period: "2026-08", mode: "client" });
    expect(old.periodKey).toBe("2026-10");
    expect(old.selection.documents.map((d) => d.id)).toEqual([october.id]);
  });

  it("um novo envio do mesmo mês substitui o anterior e o HTML vence a planilha do mesmo mês", async () => {
    const client = await createClient(baseInput, null);
    await sheet(client.id, 10);
    await html(client.id, 10, "Primeira versão");
    const fixed = await html(client.id, 10, "Versão corrigida");

    const model = await loadPortalModel(client, { tab: "comercial", mode: "client" });
    expect(model.selection.dataset).toBeNull();
    expect(model.selection.documents.map((d) => d.id)).toEqual([fixed.id]);
  });

  it("HTML antigo não passa na frente de planilhas mais novas (cliente que segue com planilha)", async () => {
    const client = await createClient(baseInput, null);
    await html(client.id, 7, "Antigo");
    await sheet(client.id, 8);
    const sep = await sheet(client.id, 9);

    const model = await loadPortalModel(client, { tab: "comercial", mode: "client" });
    expect(model.singleReport).toBe(true);
    expect(model.periodKey).toBe("2026-09");
    expect(model.selection.dataset?.entry.id).toBe(sep.id);
  });

  it("a prévia de um relatório específico no ADM continua abrindo aquele mês", async () => {
    const client = await createClient(baseInput, null);
    const aug = await html(client.id, 8, "Agosto");
    await html(client.id, 10, "Outubro");

    const model = await loadPortalModel(client, { tab: "comercial", mode: "preview", focusReportId: aug.id });
    expect(model.singleReport).toBe(false);
    expect(model.periodKey).toBe("2026-08");
  });

  it("justificativas do ano aparecem como aviso sobre o relatório", async () => {
    const created = await createClient(baseInput, null);
    await html(created.id, 10, "Outubro");
    await savePeriodNote(created.id, { type: "commercial", periodKey: "2026-08", status: "partial", text: "CRM sem os dados de agosto." }, null);
    await savePeriodNote(created.id, { type: "commercial", periodKey: "2025-12", status: "partial", text: "Ano anterior." }, null);

    const model = await loadPortalModel(await reload(created.id), { tab: "comercial", mode: "client" });
    expect(model.periodKey).toBe("2026-10");
    expect(model.notices.map((n) => n.key)).toEqual(["2026-08"]);
  });

  it("outras áreas continuam com as abas de mês", async () => {
    const client = await createClient({ ...baseInput, traffic: { ...baseInput.traffic, enabled: true } }, null);
    const model = await loadPortalModel(client, { tab: "trafego", mode: "client" });
    expect(model.singleReport).toBe(false);
  });
});
