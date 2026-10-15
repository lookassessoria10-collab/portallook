import "server-only";
import { getReportData, getReportManifest } from "@/features/reports/service";
import type { ReportIndexEntry } from "@/features/reports/schema";
import {
  commercialProfile,
  mergeCommercialMonths,
  monthNames,
  referenceEnd,
  type LiveCommercial,
} from "./model";

export async function loadLiveCommercial(
  clientId: string,
  slug: string,
  selectedKey: string | null,
  entries: ReportIndexEntry[],
  mode: "client" | "preview",
  selectedId?: string,
): Promise<LiveCommercial | null> {
  const profile = commercialProfile(slug);
  if (!profile || !selectedKey || !/^\d{4}-\d{2}$/.test(selectedKey))
    return null;
  const visible = entries.filter(
    (e) =>
      e.type === "commercial" &&
      e.kind === "dataset" &&
      e.period.granularity === "month" &&
      e.periodKey <= selectedKey &&
      e.periodKey.slice(0, 4) === selectedKey.slice(0, 4) &&
      (e.status === "published" ||
        (mode === "preview" && (e.status === "draft" || e.id === selectedId))),
  );
  const byMonth = new Map<string, ReportIndexEntry>();
  for (const e of visible.sort((a, b) =>
    a.updatedAt.localeCompare(b.updatedAt),
  )) {
    const previous = byMonth.get(e.periodKey);
    if (previous?.id === selectedId) continue;
    if (
      mode === "client" &&
      previous?.status === "published" &&
      e.status !== "published"
    )
      continue;
    byMonth.set(e.periodKey, e);
  }
  const months = await Promise.all(
    [...byMonth.values()].map(async (entry) => {
      const manifest = await getReportManifest(clientId, entry.id);
      const report =
        manifest?.clientId === clientId ? await getReportData(manifest) : null;
      if (report?.type !== "commercial" || !manifest) return null;
      if (report.data.layoutProfile && report.data.layoutProfile !== profile)
        return null;
      // Historical spreadsheets were derived from the old report and are not an
      // authoritative correction. A client template explicitly opts into replacement.
      if (
        entry.periodKey <= referenceEnd(profile) &&
        report.data.layoutProfile !== profile
      )
        return null;
      return {
        key: entry.periodKey,
        label: monthNames[Number(entry.periodKey.slice(5, 7)) - 1],
        data: report.data,
        insights: manifest.insights,
        imported: true,
      };
    }),
  );
  const valid = months.filter((m) => m !== null);
  // Keep the original historical presentation when no imported datasets exist.
  return valid.some((m) => m.key === selectedKey)
    ? mergeCommercialMonths(profile, valid, selectedKey)
    : null;
}
