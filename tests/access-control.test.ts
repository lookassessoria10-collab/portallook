import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryStorage } from "./helpers/setup";
import { createClient } from "@/features/clients/service";
import { getPortalLink, resolvePortalAccess, revokeAccessToken, rotateAccessToken, setAccessEnabled } from "@/features/clients/access";
import { setClientStatus } from "@/features/clients/service";
import { createDraftReport, publishReport } from "@/features/reports/service";
import { getVisibleReport } from "@/features/portal/access";
import { loadPortalModel } from "@/features/portal/model";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { monthPeriod } from "@/lib/dates/period";
import type { ClientInput } from "@/features/clients/input";

const moduleOn = { enabled: true, cadence: "monthly" as const, dueDay: 5, allowOriginalDownload: false };
const input = (name: string, slug: string): ClientInput => ({
  name,
  shortName: name,
  slug,
  greetingName: "",
  segment: "",
  currency: "BRL",
  notes: "",
  roiMetric: "roas",
  commercial: moduleOn,
  traffic: { ...moduleOn, cadence: "weekly", dueDay: 1 },
});

function tokenOf(url: string | null) {
  return url?.split("/").pop() ?? "";
}

async function dataset(clientId: string, month: number) {
  const data = CommercialDataSchema.parse({
    schemaVersion: 1,
    period: monthPeriod(2026, month),
    funnel: [
      { key: "leads", label: "Leads", order: 1, value: 100 },
      { key: "vendas", label: "Vendas", order: 2, value: 10 },
    ],
  });
  return createDraftReport({ clientId, type: "commercial", kind: "dataset", period: data.period, source: null, data: { type: "commercial", data } });
}

describe("controle de acesso do portal", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  it("cada link abre só o próprio cliente", async () => {
    const a = await createClient(input("Cliente A", "cliente-a"), null);
    const b = await createClient(input("Cliente B", "cliente-b"), null);
    const tokenA = tokenOf((await getPortalLink(a)).url);
    const tokenB = tokenOf((await getPortalLink(b)).url);

    expect((await resolvePortalAccess("cliente-a", tokenA))?.id).toBe(a.id);
    expect((await resolvePortalAccess("cliente-b", tokenB))?.id).toBe(b.id);
    // Token de um cliente com o slug de outro: bloqueado.
    expect(await resolvePortalAccess("cliente-a", tokenB)).toBeNull();
    expect(await resolvePortalAccess("cliente-b", tokenA)).toBeNull();
    expect(await resolvePortalAccess("nao-existe", tokenA)).toBeNull();
    expect(await resolvePortalAccess("cliente-a", "")).toBeNull();
    expect(await resolvePortalAccess("../cliente-a", tokenA)).toBeNull();
  });

  it("gerar novo link invalida o anterior; revogar e desativar bloqueiam", async () => {
    const a = await createClient(input("Cliente A", "cliente-a"), null);
    const first = tokenOf((await getPortalLink(a)).url);
    const second = await rotateAccessToken(a.id, null);
    expect(await resolvePortalAccess("cliente-a", first)).toBeNull();
    expect((await resolvePortalAccess("cliente-a", second))?.id).toBe(a.id);

    await setAccessEnabled(a.id, false, null);
    expect(await resolvePortalAccess("cliente-a", second)).toBeNull();
    await setAccessEnabled(a.id, true, null);
    expect(await resolvePortalAccess("cliente-a", second)).not.toBeNull();

    await revokeAccessToken(a.id, null);
    expect(await resolvePortalAccess("cliente-a", second)).toBeNull();
    expect((await getPortalLink(a)).url).toBeNull();
  });

  it("cliente desativado perde o acesso", async () => {
    const a = await createClient(input("Cliente A", "cliente-a"), null);
    const token = tokenOf((await getPortalLink(a)).url);
    await setClientStatus(a.id, "inactive", null);
    expect(await resolvePortalAccess("cliente-a", token)).toBeNull();
  });

  it("slug duplicado é recusado", async () => {
    await createClient(input("Cliente A", "cliente-a"), null);
    await expect(createClient(input("Outro", "cliente-a"), null)).rejects.toThrow(/já está em uso/);
  });

  it("rascunhos e relatórios de outro cliente nunca aparecem", async () => {
    const a = await createClient(input("Cliente A", "cliente-a"), null);
    const b = await createClient(input("Cliente B", "cliente-b"), null);
    const draftA = await dataset(a.id, 8);
    const publishedB = await dataset(b.id, 8);
    await publishReport(b.id, publishedB.id, null);

    expect(await getVisibleReport(a, draftA.id)).toBeNull();
    expect(await getVisibleReport(a, publishedB.id)).toBeNull();
    expect((await getVisibleReport(b, publishedB.id))?.id).toBe(publishedB.id);

    const model = await loadPortalModel(a, { mode: "client" });
    expect(model.periods).toHaveLength(0);
    const preview = await loadPortalModel(a, { mode: "preview" });
    expect(preview.periods).toHaveLength(1);

    await publishReport(a.id, draftA.id, null);
    const after = await loadPortalModel(a, { mode: "client" });
    expect(after.selection.dataset?.entry.id).toBe(draftA.id);
  });

  it("publicar nova versão do mesmo período substitui a anterior sem apagar", async () => {
    const a = await createClient(input("Cliente A", "cliente-a"), null);
    const v1 = await dataset(a.id, 8);
    await publishReport(a.id, v1.id, null);
    const v2 = await dataset(a.id, 8);
    await publishReport(a.id, v2.id, null);
    const model = await loadPortalModel(a, { mode: "client" });
    expect(model.selection.dataset?.entry.id).toBe(v2.id);
    const { getRepositories } = await import("@/server/repositories");
    const index = await getRepositories().reports.getIndex(a.id);
    expect(index.reports.find((r) => r.id === v1.id)?.status).toBe("superseded");
  });

  it("comparação usa o período anterior publicado", async () => {
    const a = await createClient(input("Cliente A", "cliente-a"), null);
    for (const m of [6, 7, 8]) {
      const r = await dataset(a.id, m);
      await publishReport(a.id, r.id, null);
    }
    const model = await loadPortalModel(a, { mode: "client", period: "2026-08" });
    expect(model.previous?.periodKey).toBe("2026-07");
    expect(model.history.map((h) => h.periodKey)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(model.archive).toHaveLength(3);
  });
});
