import "server-only";
import { cache } from "react";
import { resolvePortalAccess } from "@/features/clients/access";
import { getReportManifest } from "@/features/reports/service";
import type { Client } from "@/features/clients/schema";
import type { ReportManifest } from "@/features/reports/schema";
import { isValidId } from "@/lib/ids";

/** Validação do link por requisição (deduplicada entre layout, página e metadata). */
export const getPortalClient = cache((slug: string, token: string) => resolvePortalAccess(slug, token));

/** Só devolve relatórios do próprio cliente e publicados. */
export async function getVisibleReport(client: Client, reportId: string): Promise<ReportManifest | null> {
  if (!isValidId(reportId, "rp")) return null;
  const manifest = await getReportManifest(client.id, reportId);
  if (!manifest || manifest.clientId !== client.id || manifest.status !== "published") return null;
  return manifest;
}

export function portalBasePath(slug: string, token: string) {
  return `/c/${slug}/${token}`;
}
