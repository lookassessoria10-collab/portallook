import "server-only";
import { periodKey } from "@/lib/dates/period";
import type { ClientOverview } from "@/features/clients/service";
import type { WizardClient } from "@/features/uploads/components/upload-wizard";

/** Dados mínimos dos clientes para o assistente (sem segredos). */
export function toWizardClients(overviews: ClientOverview[]): WizardClient[] {
  return overviews
    .filter((o) => o.client.status === "active")
    .map((o) => {
      const mod = (t: "commercial" | "traffic") => {
        const m = o.client.modules[t];
        const d = o.delivery[t];
        const pending = d.state === "pending" || d.state === "error" || d.state === "draft";
        return {
          enabled: m.enabled,
          cadence: m.cadence,
          allowOriginalDownload: m.allowOriginalDownload,
          expectedKey: m.enabled && pending && d.expectedPeriod ? periodKey(d.expectedPeriod) : m.enabled && d.nextPeriod ? periodKey(d.nextPeriod) : null,
        };
      };
      return { id: o.client.id, name: o.client.name, modules: { commercial: mod("commercial"), traffic: mod("traffic") } };
    });
}
