import "server-only";
import { cache } from "react";
import { createId } from "@/lib/ids";
import { NotFoundError, UserFacingError } from "@/lib/errors";
import { formatPeriod, periodKey, type Period } from "@/lib/dates/period";
import { logEvent } from "@/features/events/service";
import { commercialSummary } from "@/features/commercial/metrics";
import { CommercialDataSchema, type CommercialData } from "@/features/commercial/schema";
import { trafficSummary } from "@/features/traffic/metrics";
import { TrafficDataSchema, type TrafficData } from "@/features/traffic/schema";
import { getRepositories } from "@/server/repositories";
import { InsightSchema, REPORT_TYPE_LABEL, type Insight, type ReportKind, type ReportManifest, type ReportType, type SourceFile, type ValidationIssue } from "./schema";

export type ReportData = { type: "commercial"; data: CommercialData } | { type: "traffic"; data: TrafficData };

export const getReportManifest = cache(async (clientId: string, reportId: string): Promise<ReportManifest | null> => {
  const repos = getRepositories();
  const index = await repos.reports.getIndex(clientId);
  const entry = index.reports.find((r) => r.id === reportId);
  if (entry) return repos.reports.getManifest(clientId, entry.type, reportId);
  // Índice desatualizado: tenta os dois tipos diretamente.
  return (await repos.reports.getManifest(clientId, "commercial", reportId)) ?? (await repos.reports.getManifest(clientId, "traffic", reportId));
});

export async function requireReport(clientId: string, reportId: string): Promise<ReportManifest> {
  const manifest = await getReportManifest(clientId, reportId);
  if (!manifest) throw new NotFoundError("Relatório não encontrado.");
  return manifest;
}

export const getReportData = cache(async (manifest: ReportManifest): Promise<ReportData | null> => {
  if (manifest.kind !== "dataset") return null;
  const raw = await getRepositories().reports.getData(manifest);
  if (!raw) return null;
  if (manifest.type === "commercial") {
    const parsed = CommercialDataSchema.safeParse(raw);
    return parsed.success ? { type: "commercial", data: parsed.data } : null;
  }
  const parsed = TrafficDataSchema.safeParse(raw);
  return parsed.success ? { type: "traffic", data: parsed.data } : null;
});

export function summarize(data: ReportData) {
  return data.type === "commercial" ? commercialSummary(data.data) : trafficSummary(data.data);
}

export interface CreateReportInput {
  clientId: string;
  type: ReportType;
  kind: ReportKind;
  period: Period;
  title?: string | null;
  source: Omit<SourceFile, "path"> | null;
  original?: { copyFrom: string } | { body: Buffer } | null;
  originalExtension?: string;
  data?: ReportData | null;
  insights?: Insight[];
  warnings?: ValidationIssue[];
  allowDownload?: boolean;
  importId?: string | null;
}

/** Cria um relatório sempre como rascunho — publicação é uma ação separada. */
export async function createDraftReport(input: CreateReportInput): Promise<ReportManifest> {
  const repos = getRepositories();
  const id = createId("rp");
  const now = new Date().toISOString();

  let dataPath: string | null = null;
  let summary: ReportManifest["summary"] = {};
  let labels: ReportManifest["labels"] = {};
  if (input.kind === "dataset") {
    if (!input.data || input.data.type !== input.type) throw new UserFacingError("Os dados do relatório não correspondem ao tipo escolhido.");
    dataPath = await repos.reports.saveData(input.clientId, input.type, id, input.data.data);
    ({ summary, labels } = summarize(input.data));
  }

  let source: SourceFile | null = null;
  if (input.source) {
    let path: string | null = null;
    if (input.original && input.originalExtension) {
      path = await repos.reports.saveOriginal(
        input.clientId,
        input.type,
        id,
        input.originalExtension,
        "copyFrom" in input.original
          ? { copyFrom: input.original.copyFrom, contentType: input.source.contentType }
          : { body: input.original.body, contentType: input.source.contentType },
      );
    }
    source = { ...input.source, path };
  }

  const manifest: ReportManifest = {
    id,
    clientId: input.clientId,
    type: input.type,
    kind: input.kind,
    period: input.period,
    periodKey: periodKey(input.period),
    title: input.title ?? null,
    status: "draft",
    source,
    dataPath,
    insights: input.insights ?? [],
    warnings: input.warnings ?? [],
    summary,
    labels,
    allowDownload: input.allowDownload ?? false,
    importId: input.importId ?? null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    unpublishedAt: null,
    archivedAt: null,
    version: 1,
  };
  return repos.reports.saveManifest(manifest);
}

async function saveWithStatus(manifest: ReportManifest, patch: Partial<ReportManifest>): Promise<ReportManifest> {
  return getRepositories().reports.saveManifest({
    ...manifest,
    ...patch,
    updatedAt: new Date().toISOString(),
    version: manifest.version + 1,
  });
}

function describe(m: ReportManifest) {
  return `${REPORT_TYPE_LABEL[m.type]} · ${formatPeriod(m.period)}`;
}

/**
 * Publica o relatório. Para dados estruturados, a versão publicada anterior do
 * mesmo período passa a "substituída" — continua no histórico, não é apagada.
 */
export async function publishReport(clientId: string, reportId: string, actor: string | null): Promise<ReportManifest> {
  const repos = getRepositories();
  const manifest = await requireReport(clientId, reportId);
  if (manifest.status === "published") return manifest;
  if (manifest.status === "archived") throw new UserFacingError("Restaure o relatório antes de publicá-lo.");

  if (manifest.kind === "dataset") {
    const index = await repos.reports.getIndex(clientId);
    const others = index.reports.filter(
      (r) => r.id !== reportId && r.type === manifest.type && r.kind === "dataset" && r.periodKey === manifest.periodKey && r.status === "published",
    );
    for (const other of others) {
      const m = await repos.reports.getManifest(clientId, other.type, other.id);
      if (m) await saveWithStatus(m, { status: "superseded" });
    }
  }

  const now = new Date().toISOString();
  const published = await saveWithStatus(manifest, { status: "published", publishedAt: now, unpublishedAt: null });
  await logEvent("report.published", { clientId, actor, summary: `${describe(manifest)} publicado.`, meta: { reportId } });
  return published;
}

export async function unpublishReport(clientId: string, reportId: string, actor: string | null): Promise<ReportManifest> {
  const manifest = await requireReport(clientId, reportId);
  if (manifest.status !== "published") return manifest;
  const updated = await saveWithStatus(manifest, { status: "unpublished", unpublishedAt: new Date().toISOString() });
  await logEvent("report.unpublished", { clientId, actor, summary: `${describe(manifest)} retirado do portal.`, meta: { reportId } });
  return updated;
}

export async function archiveReport(clientId: string, reportId: string, actor: string | null): Promise<ReportManifest> {
  const manifest = await requireReport(clientId, reportId);
  const updated = await saveWithStatus(manifest, { status: "archived", archivedAt: new Date().toISOString() });
  await logEvent("report.archived", { clientId, actor, summary: `${describe(manifest)} arquivado.`, meta: { reportId } });
  return updated;
}

export async function restoreReport(clientId: string, reportId: string, actor: string | null): Promise<ReportManifest> {
  const manifest = await requireReport(clientId, reportId);
  if (manifest.status !== "archived" && manifest.status !== "unpublished" && manifest.status !== "superseded") return manifest;
  const updated = await saveWithStatus(manifest, { status: "draft", archivedAt: null });
  await logEvent("report.updated", { clientId, actor, summary: `${describe(manifest)} voltou para rascunho.`, meta: { reportId } });
  return updated;
}

export async function updateReportDetails(
  clientId: string,
  reportId: string,
  patch: { title?: string | null; allowDownload?: boolean; insights?: Insight[] },
  actor: string | null,
): Promise<ReportManifest> {
  const manifest = await requireReport(clientId, reportId);
  const insights = patch.insights ? patch.insights.map((i) => InsightSchema.parse(i)) : manifest.insights;
  if (insights.length > 12) throw new UserFacingError("Use no máximo 12 insights por relatório.");
  const updated = await saveWithStatus(manifest, {
    title: patch.title === undefined ? manifest.title : patch.title,
    allowDownload: patch.allowDownload ?? manifest.allowDownload,
    insights,
  });
  await logEvent("report.updated", { clientId, actor, summary: `${describe(manifest)} atualizado.`, meta: { reportId } });
  return updated;
}

export function newInsightId() {
  return createId("in", 10);
}

/**
 * Reconstrói o índice a partir dos manifests e recalcula os indicadores de
 * cada relatório de dados (útil quando uma regra de cálculo muda).
 */
export async function reindexClient(clientId: string): Promise<number> {
  const repos = getRepositories();
  const index = await repos.reports.rebuildIndex(clientId);
  let updated = 0;
  for (const entry of index.reports.filter((r) => r.kind === "dataset")) {
    const manifest = await repos.reports.getManifest(clientId, entry.type, entry.id);
    if (!manifest) continue;
    const data = await getReportData(manifest);
    if (!data) continue;
    const { summary, labels } = summarize(data);
    await repos.reports.saveManifest({ ...manifest, summary, labels });
    updated++;
  }
  return updated;
}
