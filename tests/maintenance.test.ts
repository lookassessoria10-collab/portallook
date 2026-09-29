import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryStorage } from "./helpers/setup";
import type { MemoryStorageProvider } from "./helpers/memory-storage";
import { createClient } from "@/features/clients/service";
import { getPortalLink, resolvePortalAccess } from "@/features/clients/access";
import { deleteClient, repairClientIndex } from "@/features/admin/maintenance";
import { createDraftReport, publishReport } from "@/features/reports/service";
import { confirmImport, initImport, processImport, receiveFile } from "@/features/uploads/service";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { monthPeriod } from "@/lib/dates/period";
import { writeJSON } from "@/lib/storage/json";
import { paths } from "@/lib/storage/paths";
import { getRepositories } from "@/server/repositories";
import { getStorage } from "@/lib/storage";
import type { ClientInput } from "@/features/clients/input";

const input = (slug: string): ClientInput => ({
  name: `Cliente ${slug}`,
  shortName: slug,
  slug,
  greetingName: "",
  segment: "",
  currency: "BRL",
  notes: "",
  roiMetric: "roas",
  commercial: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
  traffic: { enabled: true, cadence: "weekly", dueDay: 1, allowOriginalDownload: false },
});

async function report(clientId: string) {
  const data = CommercialDataSchema.parse({
    schemaVersion: 1,
    period: monthPeriod(2026, 8),
    funnel: [
      { key: "leads", label: "Leads", order: 1, value: 10 },
      { key: "vendas", label: "Vendas", order: 2, value: 2 },
    ],
  });
  return createDraftReport({ clientId, type: "commercial", kind: "dataset", period: data.period, source: null, data: { type: "commercial", data } });
}

describe("exclusão definitiva de cliente", () => {
  let storage: MemoryStorageProvider;
  beforeEach(() => {
    storage = useMemoryStorage();
  });

  it("exige digitar o endereço e apaga tudo do cliente, sem tocar nos outros", async () => {
    const a = await createClient(input("cliente-a"), null);
    const b = await createClient(input("cliente-b"), null);
    await report(a.id);
    await report(b.id);
    const html = Buffer.from("<html><head><title>x</title></head><body>oi</body></html>");
    const init = await initImport({ clientId: a.id, reportType: "traffic", fileName: "x.html", size: html.length, contentType: "text/html", period: { start: "2026-09-21", end: "2026-09-27", granularity: "week" } });
    await receiveFile(init.importId, html);
    await processImport(init.importId);
    const tokenA = (await getPortalLink(a)).url!.split("/").pop()!;

    await expect(deleteClient(a.id, "errado", null)).rejects.toThrow(/digite exatamente/);
    const r = await deleteClient(a.id, " Cliente-A ", null);
    expect(r.files).toBeGreaterThan(3);

    expect(storage.paths().some((p) => p.startsWith(`clients/${a.id}/`))).toBe(false);
    expect(storage.paths().some((p) => p.startsWith(`imports/${init.importId}/`))).toBe(false);
    expect(await storage.exists(paths.slug("cliente-a"))).toBe(false);
    expect(await resolvePortalAccess("cliente-a", tokenA)).toBeNull();
    expect((await getRepositories().clients.list()).map((c) => c.slug)).toEqual(["cliente-b"]);
    expect(storage.paths().some((p) => p.startsWith(`clients/${b.id}/reports/`))).toBe(true);

    // O endereço fica livre para um novo cadastro.
    await expect(createClient(input("cliente-a"), null)).resolves.toBeTruthy();
  });

  it("não aceita prefixos perigosos", async () => {
    await expect(storage.deletePrefix("clients/")).resolves.toBeGreaterThanOrEqual(0);
    const { assertSafePrefix } = await import("@/lib/storage/types");
    expect(() => assertSafePrefix("clients/")).toThrow();
    expect(() => assertSafePrefix("/")).toThrow();
    expect(() => assertSafePrefix("clients/../x/")).toThrow();
    expect(() => assertSafePrefix("clients/cl_abc123def456/")).not.toThrow();
  });
});

describe("reparo do índice", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  it("corrige status de relatório e de upload quando o índice ficou para trás", async () => {
    const c = await createClient(input("reparo"), null);
    const r = await report(c.id);
    await publishReport(c.id, r.id, null);

    const csv = Buffer.from("Período;Leads;Vendas\n09/2026;30;3\n");
    const init = await initImport({ clientId: c.id, reportType: "commercial", fileName: "f.csv", size: csv.length, contentType: "text/csv", csvContent: "funnel" });
    await receiveFile(init.importId, csv);
    await processImport(init.importId);
    await confirmImport(init.importId, { periodKeys: ["2026-09"] });

    // Simula a falha vista em produção: índice congelado com status antigos.
    const repos = getRepositories();
    const index = await repos.reports.getIndex(c.id);
    await writeJSON(getStorage(), paths.clientIndex(c.id), {
      ...index,
      reports: index.reports.map((e) => ({ ...e, status: "draft" })),
      imports: index.imports.map((i) => ({ ...i, status: "validated" })),
    });

    const result = await repairClientIndex(c.id);
    expect(result.imports).toBe(1);
    const fixed = await repos.reports.getIndex(c.id);
    expect(fixed.reports.find((e) => e.id === r.id)?.status).toBe("published");
    expect(fixed.imports[0].status).toBe("imported");
  });
});

