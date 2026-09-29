import { describe, expect, it } from "vitest";
import { computeDelivery, expectedPeriodFor } from "@/features/reports/delivery";
import { monthPeriod, periodKey, weekPeriod, type Period } from "@/lib/dates/period";
import type { ImportIndexEntry, ReportIndexEntry, ReportStatus } from "@/features/reports/schema";

const monthly = { enabled: true, cadence: "monthly" as const, dueDay: 5, allowOriginalDownload: false };
const weekly = { enabled: true, cadence: "weekly" as const, dueDay: 1, allowOriginalDownload: false };

function entry(period: Period, status: ReportStatus, id = `rp_${period.start.replace(/-/g, "")}${status.slice(0, 2)}`): ReportIndexEntry {
  return {
    id,
    type: "commercial",
    kind: "dataset",
    period,
    periodKey: periodKey(period),
    title: null,
    status,
    summary: {},
    labels: {},
    allowDownload: false,
    updatedAt: "2026-09-10T12:00:00.000Z",
    publishedAt: status === "published" ? "2026-09-10T12:00:00.000Z" : null,
    createdAt: "2026-09-10T12:00:00.000Z",
    sourceType: "xlsx",
    sourceFileName: null,
    insightCount: 0,
  };
}

describe("período esperado", () => {
  it("mensal com prazo dia 5: em 29/09 espera agosto; em 03/09 ainda espera julho", () => {
    expect(expectedPeriodFor(monthly, "2026-09-29")).toEqual(monthPeriod(2026, 8));
    expect(expectedPeriodFor(monthly, "2026-09-05")).toEqual(monthPeriod(2026, 8));
    expect(expectedPeriodFor(monthly, "2026-09-03")).toEqual(monthPeriod(2026, 7));
  });

  it("semanal com prazo segunda: em 29/09 (terça) espera 21–27/09; no domingo 27/09 espera 14–20/09", () => {
    expect(expectedPeriodFor(weekly, "2026-09-29")).toEqual(weekPeriod("2026-09-21"));
    expect(expectedPeriodFor(weekly, "2026-09-28")).toEqual(weekPeriod("2026-09-21"));
    expect(expectedPeriodFor(weekly, "2026-09-27")).toEqual(weekPeriod("2026-09-14"));
  });
});

describe("status de entrega", () => {
  const today = "2026-09-29";

  it("atualizado quando o período esperado está publicado", () => {
    const d = computeDelivery({ module: monthly, reports: [entry(monthPeriod(2026, 8), "published")], today });
    expect(d.state).toBe("updated");
    expect(d.nextDueDate).toBe("2026-10-05");
  });

  it("existir um arquivo antigo não significa estar atualizado", () => {
    const d = computeDelivery({ module: monthly, reports: [entry(monthPeriod(2026, 7), "published")], today });
    expect(d.state).toBe("pending");
    expect(d.daysOverdue).toBe(24);
    expect(d.latestPublished?.periodKey).toBe("2026-07");
  });

  it("rascunho do período esperado", () => {
    const d = computeDelivery({ module: monthly, reports: [entry(monthPeriod(2026, 8), "draft")], today });
    expect(d.state).toBe("draft");
    expect(d.expectedReport?.status).toBe("draft");
  });

  it("com erro quando a última importação falhou", () => {
    const imports: ImportIndexEntry[] = [
      { id: "im_x", reportType: "commercial", fileName: "a.xlsx", format: "xlsx", status: "invalid", periodKey: null, errorCount: 1, warningCount: 0, reportIds: [], createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z" },
    ];
    expect(computeDelivery({ module: monthly, reports: [], imports, today }).state).toBe("error");
  });

  it("cliente recém-cadastrado não fica pendente de períodos anteriores", () => {
    expect(computeDelivery({ module: monthly, reports: [], today, clientSince: "2026-09-20T00:00:00Z" }).state).toBe("upcoming");
  });

  it("módulo desativado = não aplicável", () => {
    expect(computeDelivery({ module: { ...monthly, enabled: false }, reports: [], today }).state).toBe("not_applicable");
  });

  it("relatório arquivado não conta como entregue", () => {
    expect(computeDelivery({ module: monthly, reports: [entry(monthPeriod(2026, 8), "archived")], today }).state).toBe("pending");
  });
});
