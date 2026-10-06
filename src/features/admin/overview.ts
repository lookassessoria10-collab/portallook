import "server-only";
import { periodKey } from "@/lib/dates/period";
import type { ClientOverview } from "@/features/clients/service";
import type { DeliveryState, DeliveryStatus } from "@/features/reports/delivery";
import { REPORT_TYPES, type ImportIndexEntry, type ReportIndexEntry, type ReportType } from "@/features/reports/schema";

export interface ModuleCounts {
  updated: number;
  pending: number;
  draft: number;
  error: number;
  total: number;
}

export interface AttentionItem {
  clientId: string;
  clientName: string;
  type: ReportType;
  state: DeliveryState;
  delivery: DeliveryStatus;
  /** Maior = mais urgente. */
  severity: number;
}

export interface AdminOverview {
  activeClients: number;
  inactiveClients: number;
  modules: Record<ReportType, ModuleCounts>;
  importErrors: number;
  attention: AttentionItem[];
  recentImports: Array<ImportIndexEntry & { clientId: string; clientName: string }>;
  recentPublished: Array<ReportIndexEntry & { clientId: string; clientName: string }>;
}

const emptyCounts = (): ModuleCounts => ({ updated: 0, pending: 0, draft: 0, error: 0, total: 0 });

export function buildAdminOverview(overviews: ClientOverview[]): AdminOverview {
  const active = overviews.filter((o) => o.client.status === "active");
  const modules: Record<ReportType, ModuleCounts> = { commercial: emptyCounts(), traffic: emptyCounts(), media_plan: emptyCounts() };
  const attention: AttentionItem[] = [];

  for (const o of active) {
    for (const type of REPORT_TYPES) {
      const d = o.delivery[type];
      if (d.state === "not_applicable") continue;
      const c = modules[type];
      c.total++;
      if (d.state === "updated" || d.state === "upcoming") c.updated++;
      if (d.state === "pending") c.pending++;
      if (d.state === "draft") c.draft++;
      if (d.state === "error") c.error++;
      if (d.state === "pending" || d.state === "error" || d.state === "draft") {
        const severity = d.state === "error" ? 1000 : d.state === "pending" ? 500 + (d.daysOverdue ?? 0) : 100;
        attention.push({ clientId: o.client.id, clientName: o.client.name, type, state: d.state, delivery: d, severity });
      }
    }
  }

  const recentImports = overviews
    .flatMap((o) => o.index.imports.map((i) => ({ ...i, clientId: o.client.id, clientName: o.client.name })))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 8);

  const recentPublished = overviews
    .flatMap((o) => o.index.reports.filter((r) => r.status === "published" && r.publishedAt).map((r) => ({ ...r, clientId: o.client.id, clientName: o.client.name })))
    .sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? 1 : -1))
    .slice(0, 8);

  return {
    activeClients: active.length,
    inactiveClients: overviews.length - active.length,
    modules,
    importErrors: overviews.reduce((n, o) => n + o.openImportErrors, 0),
    attention: attention.sort((a, b) => b.severity - a.severity),
    recentImports,
    recentPublished,
  };
}

/** Link para enviar o relatório esperado já com cliente, tipo e período preenchidos. */
export function uploadHref(clientId: string, type: ReportType, delivery?: DeliveryStatus | null): string {
  const params = new URLSearchParams({ cliente: clientId, tipo: type });
  if (delivery?.expectedPeriod) params.set("periodo", periodKey(delivery.expectedPeriod));
  return `/adm/uploads?${params.toString()}`;
}

/** Envio de meses anteriores de tráfego (retroativo), já com o cliente escolhido. */
export function retroactiveUploadHref(clientId: string): string {
  return `/adm/uploads?${new URLSearchParams({ cliente: clientId, tipo: "traffic", modo: "retroativo" }).toString()}`;
}
