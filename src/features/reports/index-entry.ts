import type { ClientIndex, ImportIndexEntry, ReportIndexEntry, ReportManifest } from "./schema";

export function toIndexEntry(m: ReportManifest): ReportIndexEntry {
  return {
    id: m.id,
    type: m.type,
    kind: m.kind,
    period: m.period,
    periodKey: m.periodKey,
    title: m.title,
    status: m.status,
    summary: m.summary,
    labels: m.labels,
    allowDownload: m.allowDownload,
    retroactive: m.retroactive,
    updatedAt: m.updatedAt,
    publishedAt: m.publishedAt,
    createdAt: m.createdAt,
    sourceType: m.source?.type ?? null,
    sourceFileName: m.source?.fileName ?? null,
    insightCount: m.insights.length,
  };
}

export function upsertReportEntry(index: ClientIndex, entry: ReportIndexEntry, now: string): ClientIndex {
  const reports = index.reports.filter((r) => r.id !== entry.id);
  reports.push(entry);
  reports.sort((a, b) => (a.period.start < b.period.start ? 1 : a.period.start > b.period.start ? -1 : a.createdAt < b.createdAt ? 1 : -1));
  return { ...index, reports, updatedAt: now };
}

const MAX_IMPORTS_IN_INDEX = 40;

export function upsertImportEntry(index: ClientIndex, entry: ImportIndexEntry, now: string): ClientIndex {
  const imports = [entry, ...index.imports.filter((i) => i.id !== entry.id)]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MAX_IMPORTS_IN_INDEX);
  return { ...index, imports, updatedAt: now };
}

export function removeImportEntry(index: ClientIndex, importId: string, now: string): ClientIndex {
  return { ...index, imports: index.imports.filter((i) => i.id !== importId), updatedAt: now };
}

export function emptyIndex(clientId: string, now: string): ClientIndex {
  return { clientId, updatedAt: now, reports: [], imports: [] };
}
