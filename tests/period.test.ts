import { describe, expect, it } from "vitest";
import { formatDate, formatPeriod, isoWeekday, monthPeriod, parsePeriodKey, periodKey, previousPeriod, todayISO, weekPeriod } from "@/lib/dates/period";

describe("períodos", () => {
  it("21/09/2026 é segunda-feira e a semana vai até domingo 27/09", () => {
    expect(isoWeekday("2026-09-21")).toBe(1);
    expect(weekPeriod("2026-09-24")).toEqual({ start: "2026-09-21", end: "2026-09-27", granularity: "week" });
  });

  it("formata mês, semana e intervalo", () => {
    expect(formatPeriod(monthPeriod(2026, 9))).toBe("Setembro de 2026");
    expect(formatPeriod(weekPeriod("2026-09-21"))).toBe("21 a 27 de setembro de 2026");
    expect(formatPeriod(weekPeriod("2026-09-28"))).toBe("28 de setembro a 4 de outubro de 2026");
    expect(formatPeriod(weekPeriod("2026-09-21"), "short")).toBe("21/09 a 27/09");
    expect(formatPeriod({ start: "2026-09-01", end: "2026-09-15", granularity: "custom" })).toBe("01/09/2026 a 15/09/2026");
    expect(formatDate("2026-09-28")).toBe("28/09/2026");
  });

  it("chaves de período são reversíveis", () => {
    for (const p of [monthPeriod(2026, 2), weekPeriod("2026-09-21"), { start: "2026-09-01", end: "2026-09-10", granularity: "custom" as const }]) {
      expect(parsePeriodKey(periodKey(p))).toEqual(p);
    }
    expect(parsePeriodKey("2026-13")).toBeNull();
    expect(parsePeriodKey("../../x")).toBeNull();
  });

  it("período anterior", () => {
    expect(previousPeriod(monthPeriod(2026, 1))).toEqual(monthPeriod(2025, 12));
    expect(previousPeriod(weekPeriod("2026-09-21")).start).toBe("2026-09-14");
    expect(monthPeriod(2028, 2).end).toBe("2028-02-29");
  });

  it("hoje respeita o fuso de São Paulo", () => {
    // 02:00 UTC do dia 30 ainda é dia 29 em São Paulo (UTC−3).
    expect(todayISO("America/Sao_Paulo", new Date("2026-09-30T02:00:00Z"))).toBe("2026-09-29");
    expect(todayISO("UTC", new Date("2026-09-30T02:00:00Z"))).toBe("2026-09-30");
  });
});
