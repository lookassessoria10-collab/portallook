import { addDays, formatPeriod, monthPeriod, periodKey, previousPeriod, startOfWeek, weekPeriod } from "@/lib/dates/period";

export interface PeriodOption {
  key: string;
  label: string;
}

/** Períodos oferecidos no assistente (mais recentes primeiro). */
export function periodOptions(cadence: "monthly" | "weekly", today: string, count = cadence === "monthly" ? 18 : 16): PeriodOption[] {
  const out: PeriodOption[] = [];
  if (cadence === "monthly") {
    let p = monthPeriod(+today.slice(0, 4), +today.slice(5, 7));
    for (let i = 0; i < count; i++) {
      out.push({ key: periodKey(p), label: formatPeriod(p) });
      p = previousPeriod(p);
    }
    return out;
  }
  let start = startOfWeek(today);
  for (let i = 0; i < count; i++) {
    const p = weekPeriod(start);
    out.push({ key: periodKey(p), label: formatPeriod(p) });
    start = addDays(start, -7);
  }
  return out;
}
