/**
 * Popula o armazenamento com os clientes de demonstração.
 *
 *   npm run seed            # cria o que ainda não existe
 *   npm run seed -- --reset # apaga os dados locais (.data) e recria tudo
 *
 * Funciona com os dois drivers (local e Vercel Blob). --reset só é aceito no local.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { buildDemoClients } from "@/features/demo/data";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { TrafficDataSchema } from "@/features/traffic/schema";
import { buildPortalPath, portalBaseUrl, rotateAccessToken } from "@/features/clients/access";
import { createDraftReport, newInsightId, publishReport, type ReportData } from "@/features/reports/service";
import { upsertImportEntry } from "@/features/reports/index-entry";
import { formatPeriod } from "@/lib/dates/period";
import { createId } from "@/lib/ids";
import { env, storageDriver } from "@/lib/env";
import { paths } from "@/lib/storage/paths";
import { getRepositories } from "@/server/repositories";
import { buildDemoLegacyHtml, buildDemoPdf } from "./demo-documents";

async function main() {
  const reset = process.argv.includes("--reset");
  const driver = storageDriver();
  if (reset) {
    if (driver !== "local") throw new Error("--reset só pode ser usado com STORAGE_DRIVER=local.");
    const dir = path.resolve(process.cwd(), env().LOCAL_STORAGE_DIR);
    await rm(dir, { recursive: true, force: true });
    console.log(`Dados locais removidos (${dir}).`);
  }

  const repos = getRepositories();
  const links: string[] = [];

  for (const demo of buildDemoClients()) {
    const existing = await repos.clients.getBySlug(demo.client.slug);
    if (existing) {
      console.log(`• ${demo.client.name}: já existe, mantido.`);
      continue;
    }
    const id = createId("cl");
    const client = await repos.clients.create({ ...demo.client, id, logo: null, createdAt: demo.createdAt, updatedAt: demo.createdAt, version: 1 });
    const token = await rotateAccessToken(client.id, "seed");
    links.push(`${client.name.padEnd(28)} ${portalBaseUrl()}${buildPortalPath(client.slug, token)}`);

    let count = 0;
    for (const r of demo.reports) {
      const insights = (r.insights ?? []).map((i) => ({ ...i, id: newInsightId(), source: "manual" as const }));
      let manifest;
      if (r.document) {
        const label = formatPeriod(r.period);
        const body = r.document.kind === "pdf" ? await buildDemoPdf(r.document.title, client.name, label) : buildDemoLegacyHtml(client.name, label);
        const isPdf = r.document.kind === "pdf";
        manifest = await createDraftReport({
          clientId: client.id,
          type: r.type,
          kind: "document",
          period: r.period,
          title: r.document.title,
          source: {
            type: r.document.kind,
            fileName: isPdf ? `relatorio-${r.period.start.slice(0, 7)}.pdf` : `dashboard-${r.period.start.slice(0, 7)}.html`,
            size: body.length,
            contentType: isPdf ? "application/pdf" : "text/html; charset=utf-8",
          },
          original: { body },
          originalExtension: isPdf ? "pdf" : "html",
          insights,
          allowDownload: r.document.allowDownload,
        });
      } else {
        const data: ReportData =
          r.type === "commercial"
            ? { type: "commercial", data: CommercialDataSchema.parse(r.commercial) }
            : { type: "traffic", data: TrafficDataSchema.parse(r.traffic) };
        const json = Buffer.from(JSON.stringify(data.data));
        manifest = await createDraftReport({
          clientId: client.id,
          type: r.type,
          kind: "dataset",
          period: r.period,
          source: { type: "seed", fileName: "dados-demonstracao.json", size: json.length, contentType: "application/json" },
          data,
          insights,
          allowDownload: false,
        });
      }
      if (r.status === "published") await publishReport(client.id, manifest.id, "seed");
      count++;
    }

    for (const err of demo.importErrors ?? []) {
      const now = new Date().toISOString();
      const importId = createId("im");
      const issues = err.issues.map((i) => ({
        level: "error" as const,
        code: i.code,
        message: i.message,
        location: { sheet: i.sheet, row: i.row, column: i.column },
      }));
      await repos.imports.save({
        id: importId,
        clientId: client.id,
        reportType: err.type,
        format: err.format,
        fileName: err.fileName,
        size: 18_432,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        stagingPath: paths.importOriginal(importId, err.format),
        status: "invalid",
        csvContent: null,
        csvDimensionLabel: null,
        requestedPeriod: null,
        title: null,
        allowDownload: false,
        issues,
        preview: null,
        parsedPath: null,
        reportIds: [],
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      await repos.reports.updateIndex(client.id, (index) =>
        upsertImportEntry(
          index,
          {
            id: importId,
            reportType: err.type,
            fileName: err.fileName,
            format: err.format,
            status: "invalid",
            periodKey: null,
            errorCount: issues.length,
            warningCount: 0,
            reportIds: [],
            createdAt: now,
            updatedAt: now,
          },
          now,
        ),
      );
    }
    console.log(`• ${client.name}: ${count} relatórios criados.`);
  }

  if (links.length) {
    console.log("\nLinks exclusivos (guarde com cuidado — dão acesso ao portal do cliente):");
    for (const l of links) console.log(`  ${l}`);
  }
  console.log(`\nConcluído (storage: ${driver}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
