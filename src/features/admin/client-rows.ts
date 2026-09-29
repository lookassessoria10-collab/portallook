import "server-only";
import { formatPeriod } from "@/lib/dates/period";
import { getPortalLink } from "@/features/clients/access";
import type { ClientOverview } from "@/features/clients/service";
import type { DeliveryState } from "@/features/reports/delivery";
import type { ReportType } from "@/features/reports/schema";

export interface ModuleCell {
  enabled: boolean;
  state: DeliveryState;
  periodLabel: string | null;
  dueDate: string | null;
  daysOverdue: number | null;
  latestLabel: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  slug: string;
  segment: string;
  status: "active" | "inactive" | "archived";
  modules: Record<ReportType, ModuleCell>;
  lastUpdatedAt: string | null;
  nextDueDate: string | null;
  portalUrl: string | null;
  accessEnabled: boolean;
  openImportErrors: number;
}

export async function buildClientRows(overviews: ClientOverview[]): Promise<ClientRow[]> {
  return Promise.all(
    overviews.map(async (o) => {
      const link = await getPortalLink(o.client);
      const modules = {} as Record<ReportType, ModuleCell>;
      const dues: string[] = [];
      for (const type of ["commercial", "traffic"] as const) {
        const d = o.delivery[type];
        const enabled = o.client.modules[type].enabled;
        const pendingNow = d.state === "pending" || d.state === "error" || d.state === "draft";
        const due = pendingNow ? d.expectedDueDate : d.nextDueDate;
        if (enabled && due) dues.push(due);
        modules[type] = {
          enabled,
          state: d.state,
          periodLabel: pendingNow ? (d.expectedPeriod ? formatPeriod(d.expectedPeriod, "short") : null) : d.latestPublished ? formatPeriod(d.latestPublished.period, "short") : null,
          dueDate: due,
          daysOverdue: d.daysOverdue,
          latestLabel: d.latestPublished ? formatPeriod(d.latestPublished.period, "short") : null,
        };
      }
      return {
        id: o.client.id,
        name: o.client.name,
        slug: o.client.slug,
        segment: o.client.segment,
        status: o.client.status,
        modules,
        lastUpdatedAt: o.lastUpdatedAt,
        nextDueDate: dues.sort()[0] ?? null,
        portalUrl: link.access?.enabled ? link.url : null,
        accessEnabled: Boolean(link.access?.enabled),
        openImportErrors: o.openImportErrors,
      };
    }),
  );
}
