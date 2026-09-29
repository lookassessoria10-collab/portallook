import { addDays, diffDays, formatPeriod, isoWeekday, monthPeriod, periodKey, weekPeriod, type Period } from "@/lib/dates/period";
import { dateCell, describeCell, monthCell } from "@/lib/parsers/cells";
import type { CellValue } from "@/lib/parsers/types";
import type { IssueCollector } from "./issues";

export interface PeriodContext {
  granularity: "month" | "week";
  requestedPeriod: Period | null;
}

/** Período de uma linha a partir da coluna "Período" (mês ou data da semana). */
export function resolveRowPeriod(value: CellValue | undefined, ctx: PeriodContext, issues: IssueCollector, where: { sheet: string; line: number; column: string | null }): Period | null {
  if (where.column === null) {
    if (ctx.requestedPeriod) return ctx.requestedPeriod;
    issues.error("missing_period", `A aba ${where.sheet} não tem coluna de período. Selecione o período no passo anterior ou inclua a coluna "Período".`, { sheet: where.sheet });
    return null;
  }
  if (value === null || value === undefined || value === "") {
    if (ctx.requestedPeriod) return ctx.requestedPeriod;
    issues.error("invalid_period", `A coluna Período precisa ser preenchida (aba ${where.sheet}, linha ${where.line}).`, { sheet: where.sheet, row: where.line, column: where.column });
    return null;
  }
  if (ctx.granularity === "month") {
    const m = monthCell(value);
    if (m) return monthPeriod(m.year, m.month);
  } else {
    const d = dateCell(value);
    if (d) return weekPeriod(d);
  }
  issues.error("invalid_period", `O período "${describeCell(value)}" na aba ${where.sheet}, linha ${where.line}, não é válido. Use, por exemplo, ${ctx.granularity === "month" ? '"09/2026" ou "setembro/2026"' : '"21/09/2026"'}.`, {
    sheet: where.sheet,
    row: where.line,
    column: where.column,
  });
  return null;
}

/** Período de campanha a partir de início/fim. Semana seg–dom vira "week"; outros intervalos, "custom". */
export function resolveRangePeriod(start: string | null, end: string | null, ctx: PeriodContext, issues: IssueCollector, where: { sheet: string; line: number }): Period | null {
  if (!start && !end) {
    if (ctx.requestedPeriod) return ctx.requestedPeriod;
    issues.error("missing_period", `Informe as datas de início e fim das campanhas (aba ${where.sheet}, linha ${where.line}) ou selecione o período no assistente.`, { sheet: where.sheet, row: where.line });
    return null;
  }
  const s = start ?? (end ? addDays(end, -6) : null);
  const e = end ?? (start ? addDays(start, 6) : null);
  if (!s || !e || s > e) {
    issues.error("invalid_period", `O período da linha ${where.line} (aba ${where.sheet}) é inválido: a data de início precisa ser anterior à de fim.`, { sheet: where.sheet, row: where.line });
    return null;
  }
  if (diffDays(e, s) === 6 && isoWeekday(s) === 1) return { start: s, end: e, granularity: "week" };
  const month = monthPeriod(+s.slice(0, 4), +s.slice(5, 7));
  if (month.start === s && month.end === e) return month;
  return { start: s, end: e, granularity: "custom" };
}

export function periodLabel(p: Period) {
  return formatPeriod(p);
}

export function keyOf(p: Period) {
  return periodKey(p);
}
