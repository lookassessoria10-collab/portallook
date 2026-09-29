import { beforeEach, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { useMemoryStorage } from "./helpers/setup";
import type { MemoryStorageProvider } from "./helpers/memory-storage";
import { createClient } from "@/features/clients/service";
import { confirmImport, discardImport, initImport, processImport, receiveFile } from "@/features/uploads/service";
import { getReportData, getReportManifest, publishReport } from "@/features/reports/service";
import { commercialTemplateWorkbook, CSV_TRAFFIC_EXAMPLE, structuredHtmlExample, trafficTemplateWorkbook, workbookBuffer } from "@/features/uploads/templates";
import { getRepositories } from "@/server/repositories";
import { monthPeriod, weekPeriod } from "@/lib/dates/period";
import type { ClientInput } from "@/features/clients/input";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
    commercial: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: true },
    traffic: { enabled: true, cadence: "weekly", dueDay: 1, allowOriginalDownload: false },
  };
}

async function upload(clientId: string, reportType: "commercial" | "traffic", fileName: string, body: Buffer, extra: Partial<Parameters<typeof initImport>[0]> = {}) {
  const init = await initImport({ clientId, reportType, fileName, size: body.length, contentType: "", ...extra });
  await receiveFile(init.importId, body);
  return processImport(init.importId);
}

describe("fluxo de importação (upload → validação → rascunho → publicação)", () => {
  let storage: MemoryStorageProvider;
  beforeEach(() => {
    storage = useMemoryStorage();
  });

  it("planilha comercial gera rascunhos com dados normalizados e preserva o original", async () => {
    const client = await createClient(clientInput("isabor", "Dra. Isabor Sant'Anna"), null);
    const record = await upload(client.id, "commercial", "comercial.xlsx", workbookBuffer(commercialTemplateWorkbook()), { contentType: XLSX_MIME, period: monthPeriod(2026, 9) });
    expect(record.status).toBe("validated");
    expect(record.preview?.periods.map((p) => p.periodKey)).toEqual(["2026-08", "2026-09"]);
    expect(record.preview?.suggestedPeriodKeys).toEqual(["2026-09"]);

    const done = await confirmImport(record.id, { periodKeys: ["2026-08", "2026-09"] });
    expect(done.status).toBe("imported");
    expect(done.reportIds).toHaveLength(2);

    const manifest = (await getReportManifest(client.id, done.reportIds[1]))!;
    expect(manifest.status).toBe("draft");
    expect(manifest.source?.type).toBe("xlsx");
    expect(manifest.source?.path).toMatch(/original\.xlsx$/);
    expect(await storage.exists(manifest.source!.path!)).toBe(true);
    expect(manifest.summary.leads).toBe(281);
    expect(manifest.insights).toHaveLength(2);
    const data = await getReportData(manifest);
    expect(data?.type).toBe("commercial");
    // O arquivo temporário é removido após a importação.
    expect(await storage.exists(record.stagingPath)).toBe(false);

    await publishReport(client.id, manifest.id, null);
    const index = await getRepositories().reports.getIndex(client.id);
    expect(index.reports.find((r) => r.id === manifest.id)?.status).toBe("published");
    expect(index.imports[0].status).toBe("imported");
  });

  it("CSV parcial (canais) atualiza só a seção enviada, criando nova versão", async () => {
    const client = await createClient(clientInput("larplan", "Larplan"), null);
    const first = await upload(client.id, "commercial", "funil.csv", Buffer.from("Período;Leads;Vendas\n09/2026;52;5\n"), { csvContent: "funnel" });
    expect(first.status).toBe("validated");
    const [baseId] = (await confirmImport(first.id, { periodKeys: ["2026-09"] })).reportIds;

    const channels = await upload(client.id, "commercial", "canais.csv", Buffer.from("Período;Canal;Tipo;Vendas;Receita\n09/2026;Google Ads;Mídia paga;3;50600\n"), { csvContent: "channels" });
    expect(channels.status).toBe("validated");
    const [mergedId] = (await confirmImport(channels.id, { periodKeys: ["2026-09"] })).reportIds;
    expect(mergedId).not.toBe(baseId);
    const merged = await getReportData((await getReportManifest(client.id, mergedId))!);
    expect(merged?.type === "commercial" && merged.data.funnel.map((s) => s.value)).toEqual([52, 5]);
    expect(merged?.type === "commercial" && merged.data.channels[0].revenue).toBe(50600);
  });

  it("CSV de canais sem funil existente é recusado com mensagem clara", async () => {
    const client = await createClient(clientInput("serenity", "Serenity"), null);
    const rec = await upload(client.id, "commercial", "canais.csv", Buffer.from("Período;Canal;Leads\n09/2026;Meta Ads;10\n"), { csvContent: "channels" });
    await expect(confirmImport(rec.id, { periodKeys: ["2026-09"] })).rejects.toThrow(/Envie primeiro o funil/);
  });

  it("tráfego via XLSX e CSV", async () => {
    const client = await createClient(clientInput("il-distribuidora", "IL Distribuidora"), null);
    const xlsx = await upload(client.id, "traffic", "trafego.xlsx", workbookBuffer(trafficTemplateWorkbook()), { contentType: XLSX_MIME });
    // O modelo é da Dra. Isabor: o cliente é incompatível.
    expect(xlsx.status).toBe("invalid");
    expect(xlsx.issues.some((i) => i.code === "client_mismatch")).toBe(true);

    const csv = await upload(client.id, "traffic", "trafego.csv", Buffer.from(CSV_TRAFFIC_EXAMPLE), { csvContent: "traffic" });
    expect(csv.status).toBe("validated");
    const done = await confirmImport(csv.id, { periodKeys: csv.preview!.suggestedPeriodKeys });
    const manifest = (await getReportManifest(client.id, done.reportIds[0]))!;
    expect(manifest.period).toEqual(weekPeriod("2026-09-21"));
    expect(manifest.summary.results).toBe(104);
  });

  it("arquivo com extensão falsa é bloqueado pela validação de conteúdo", async () => {
    const client = await createClient(clientInput("teste", "Teste"), null);
    const rec = await upload(client.id, "commercial", "planilha.xlsx", Buffer.from("isto é só texto, não é Excel"), { contentType: XLSX_MIME });
    expect(rec.status).toBe("invalid");
    expect(rec.issues[0].message).toMatch(/conteúdo parece ser CSV/);
    const index = await getRepositories().reports.getIndex(client.id);
    expect(index.imports[0].status).toBe("invalid");
    await discardImport(rec.id);
    expect((await getRepositories().imports.get(rec.id))?.status).toBe("discarded");
  });

  it("validações de metadados: formato, tamanho, MIME, CSV sem conteúdo, PDF sem período", async () => {
    const client = await createClient(clientInput("teste", "Teste"), null);
    await expect(initImport({ clientId: client.id, reportType: "commercial", fileName: "x.exe", size: 10, contentType: "" })).rejects.toThrow(/Formato não aceito/);
    await expect(initImport({ clientId: client.id, reportType: "commercial", fileName: "x.xlsx", size: 999 * 1024 * 1024, contentType: "" })).rejects.toThrow(/limite/);
    await expect(initImport({ clientId: client.id, reportType: "commercial", fileName: "x.pdf", size: 10, contentType: "image/png" })).rejects.toThrow(/não corresponde/);
    await expect(initImport({ clientId: client.id, reportType: "commercial", fileName: "x.csv", size: 10, contentType: "text/csv" })).rejects.toThrow(/conteúdo do CSV/);
    await expect(initImport({ clientId: client.id, reportType: "commercial", fileName: "x.pdf", size: 10, contentType: "application/pdf" })).rejects.toThrow(/período/);
  });

  it("PDF e HTML legado viram documentos; HTML estruturado vira dashboard", async () => {
    const client = await createClient(clientInput("isabor", "Dra. Isabor Sant'Anna"), null);
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const pdfRec = await upload(client.id, "commercial", "relatorio.pdf", Buffer.from(await pdf.save()), { contentType: "application/pdf", period: monthPeriod(2026, 9), title: "Relatório completo" });
    expect(pdfRec.status).toBe("validated");
    expect(pdfRec.preview?.kind).toBe("document");
    const pdfDone = await confirmImport(pdfRec.id, { periodKeys: [] });
    const pdfManifest = (await getReportManifest(client.id, pdfDone.reportIds[0]))!;
    expect(pdfManifest.kind).toBe("document");
    expect(pdfManifest.title).toBe("Relatório completo");

    const legacy = await upload(client.id, "commercial", "antigo.html", Buffer.from("<html><head><title>Antigo</title></head><body><script>1</script></body></html>"), { contentType: "text/html", period: monthPeriod(2026, 7) });
    expect(legacy.preview?.sourceType).toBe("html_legacy");

    const structured = await upload(client.id, "commercial", "estruturado.html", Buffer.from(structuredHtmlExample()), { contentType: "text/html" });
    expect(structured.status).toBe("validated");
    expect(structured.preview?.kind).toBe("dataset");
    const done = await confirmImport(structured.id, { periodKeys: ["2026-09"] });
    const m = (await getReportManifest(client.id, done.reportIds[0]))!;
    expect(m.source?.type).toBe("html_structured");
    expect(m.summary.leads).toBe(281);
  });
});
