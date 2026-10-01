import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryStorage } from "./helpers/setup";
import type { MemoryStorageProvider } from "./helpers/memory-storage";
import { createClient } from "@/features/clients/service";
import { confirmImport, deleteImport, initImport, processImport, receiveFile } from "@/features/uploads/service";
import { changeReportPeriod, getReportData, getReportManifest, publishReport } from "@/features/reports/service";
import { computeDelivery } from "@/features/reports/delivery";
import { getRepositories } from "@/server/repositories";
import { monthPeriod } from "@/lib/dates/period";
import type { ClientInput } from "@/features/clients/input";

function clientInput(slug: string, name: string): ClientInput {
  return {
    name,
    shortName: name,
    slug,
    greetingName: "",
    segment: "",
    currency: "BRL",
    notes: "",
    roiMetric: "roas",
    commercial: { enabled: true, cadence: "monthly", dueDay: 28, allowOriginalDownload: true },
    traffic: { enabled: true, cadence: "monthly", dueDay: 28, allowOriginalDownload: false },
  };
}

/** Planilha de tráfego com as datas de junho (ex.: modelo reaproveitado de outro mês). */
const JUNE_CSV = `Início;Fim;Plataforma;Campanha;Investimento;Impressões;Resultados;Tipo de resultado
01/06/2026;30/06/2026;Meta Ads;Captação | WhatsApp;500;20000;40;Conversas no WhatsApp
`;

async function upload(clientId: string, body: string, period = monthPeriod(2026, 8)) {
  const buffer = Buffer.from(body);
  const init = await initImport({ clientId, reportType: "traffic", fileName: "modelo-trafego.csv", size: buffer.length, contentType: "text/csv", csvContent: "traffic", period });
  await receiveFile(init.importId, buffer);
  return processImport(init.importId);
}

async function trafficDelivery(clientId: string) {
  const client = (await getRepositories().clients.get(clientId))!;
  const index = await getRepositories().reports.getIndex(clientId);
  return computeDelivery({ module: client.modules.traffic, reports: index.reports.filter((r) => r.type === "traffic"), imports: index.imports.filter((i) => i.reportType === "traffic"), today: "2026-09-29" });
}

describe("período escolhido diferente das datas do arquivo", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  it("a prévia pede a decisão e o ADM pode importar no período escolhido", async () => {
    const client = await createClient(clientInput("landim", "Instituto Landim"), null);
    const rec = await upload(client.id, JUNE_CSV);
    expect(rec.status).toBe("validated");
    expect(rec.preview?.periodMismatch).toEqual({ requestedKey: "2026-08", requestedLabel: "Agosto de 2026", existing: "none" });
    expect(rec.issues.find((i) => i.code === "requested_period_missing")?.message).toMatch(/datas da planilha são de Junho de 2026/);
    // Sem saber o período final, o aviso de comparação seria enganoso.
    expect(rec.issues.some((i) => i.code === "no_previous")).toBe(false);

    const done = await confirmImport(rec.id, { periodKeys: [], useRequestedPeriod: true });
    const manifest = (await getReportManifest(client.id, done.reportIds[0]))!;
    expect(manifest.periodKey).toBe("2026-08");
    expect(manifest.warnings.some((w) => w.code === "requested_period_missing")).toBe(false);
    const data = await getReportData(manifest);
    expect(data?.data.period).toEqual(monthPeriod(2026, 8));
    expect(manifest.summary.investment).toBe(500);

    await publishReport(client.id, manifest.id, null);
    expect((await trafficDelivery(client.id)).state).toBe("updated");
  });

  it("manter o período do arquivo continua possível", async () => {
    const client = await createClient(clientInput("landim", "Instituto Landim"), null);
    const rec = await upload(client.id, JUNE_CSV);
    const done = await confirmImport(rec.id, { periodKeys: ["2026-06"] });
    expect((await getReportManifest(client.id, done.reportIds[0]))!.periodKey).toBe("2026-06");
  });

  it("não troca o período quando o arquivo já tem o período escolhido", async () => {
    const client = await createClient(clientInput("landim", "Instituto Landim"), null);
    const rec = await upload(client.id, JUNE_CSV, monthPeriod(2026, 6));
    expect(rec.preview?.periodMismatch).toBeNull();
    await expect(confirmImport(rec.id, { periodKeys: [], useRequestedPeriod: true })).rejects.toThrow(/Não é possível trocar o período/);
  });
});

describe("corrigir o período de um relatório já publicado", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  it("move o relatório (e os dados) para o período correto e resolve a pendência", async () => {
    const client = await createClient(clientInput("landim", "Instituto Landim"), null);
    // Situação real: publicado com as datas de junho, e agosto seguia pendente.
    const rec = await upload(client.id, JUNE_CSV);
    const [reportId] = (await confirmImport(rec.id, { periodKeys: ["2026-06"] })).reportIds;
    await publishReport(client.id, reportId, null);
    expect((await trafficDelivery(client.id)).state).toBe("pending");

    const updated = await changeReportPeriod(client.id, reportId, monthPeriod(2026, 8), null);
    expect(updated.status).toBe("published");
    expect(updated.periodKey).toBe("2026-08");
    expect(updated.warnings.some((w) => w.code === "requested_period_missing")).toBe(false);
    expect((await getReportData(updated))?.data.period).toEqual(monthPeriod(2026, 8));
    const index = await getRepositories().reports.getIndex(client.id);
    expect(index.reports.find((r) => r.id === reportId)?.periodKey).toBe("2026-08");
    expect((await trafficDelivery(client.id)).state).toBe("updated");
  });

  it("não deixa dois dashboards publicados no mesmo período", async () => {
    const client = await createClient(clientInput("landim", "Instituto Landim"), null);
    const a = await upload(client.id, JUNE_CSV);
    const [juneId] = (await confirmImport(a.id, { periodKeys: ["2026-06"] })).reportIds;
    const b = await upload(client.id, JUNE_CSV);
    const [augustId] = (await confirmImport(b.id, { periodKeys: [], useRequestedPeriod: true })).reportIds;
    await publishReport(client.id, juneId, null);
    await publishReport(client.id, augustId, null);
    await expect(changeReportPeriod(client.id, juneId, monthPeriod(2026, 8), null)).rejects.toThrow(/Já existe um relatório publicado de Agosto de 2026/);
  });
});

describe("excluir upload", () => {
  let storage: MemoryStorageProvider;
  beforeEach(() => {
    storage = useMemoryStorage();
  });

  it("remove registro e arquivo; relatórios criados continuam intactos", async () => {
    const client = await createClient(clientInput("landim", "Instituto Landim"), null);
    const rec = await upload(client.id, JUNE_CSV);
    const [reportId] = (await confirmImport(rec.id, { periodKeys: [], useRequestedPeriod: true })).reportIds;

    await deleteImport(client.id, rec.id, null);
    expect(await getRepositories().imports.get(rec.id)).toBeNull();
    expect((await storage.list(`imports/${rec.id}/`)).length).toBe(0);
    const index = await getRepositories().reports.getIndex(client.id);
    expect(index.imports.some((i) => i.id === rec.id)).toBe(false);
    const manifest = (await getReportManifest(client.id, reportId))!;
    expect(await storage.exists(manifest.source!.path!)).toBe(true);
  });

  it("upload com erro também sai da lista (e deixa de marcar pendência como erro)", async () => {
    const client = await createClient(clientInput("landim", "Instituto Landim"), null);
    const bad = await upload(client.id, "Início;Fim;Plataforma\n01/08/2026;31/08/2026;Meta Ads\n");
    expect(bad.status).toBe("invalid");
    expect((await trafficDelivery(client.id)).state).toBe("error");
    await deleteImport(client.id, bad.id, null);
    expect((await trafficDelivery(client.id)).state).toBe("pending");
  });

  it("recusa excluir upload de outro cliente", async () => {
    const a = await createClient(clientInput("landim", "Instituto Landim"), null);
    const b = await createClient(clientInput("outro", "Outro"), null);
    const rec = await upload(a.id, JUNE_CSV);
    await expect(deleteImport(b.id, rec.id, null)).rejects.toThrow(/não encontrada/);
    expect(await getRepositories().imports.get(rec.id)).not.toBeNull();
  });
});
