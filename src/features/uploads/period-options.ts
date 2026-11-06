import { addDays, formatPeriod, monthPeriod, nextPeriod, periodKey, previousPeriod, startOfWeek, weekPeriod } from "@/lib/dates/period";

export interface PeriodOption {
  key: string;
  label: string;
}

/** Anos anteriores oferecidos nas entregas mensais (a escolha é por ano e depois por mês, então a lista pode ser longa). */
const MONTHLY_YEARS_BACK = 2;

/**
 * Períodos oferecidos no assistente (mais recentes primeiro). `ahead`: meses
 * futuros no topo da lista — o plano de mídia é enviado antes do mês começar.
 * Mensal, por padrão: de janeiro de dois anos atrás até o mês corrente.
 */
export function periodOptions(cadence: "monthly" | "weekly", today: string, count?: number, ahead = 0): PeriodOption[] {
  const out: PeriodOption[] = [];
  if (cadence === "monthly") {
    const year = +today.slice(0, 4);
    const month = +today.slice(5, 7);
    let total = count ?? MONTHLY_YEARS_BACK * 12 + month;
    let p = monthPeriod(year, month);
    for (let i = 0; i < ahead; i++) p = nextPeriod(p);
    total += ahead;
    for (let i = 0; i < total; i++) {
      out.push({ key: periodKey(p), label: formatPeriod(p) });
      p = previousPeriod(p);
    }
    return out;
  }
  let start = startOfWeek(today);
  for (let i = 0; i < (count ?? 16); i++) {
    const p = weekPeriod(start);
    out.push({ key: periodKey(p), label: formatPeriod(p) });
    start = addDays(start, -7);
  }
  return out;
}
