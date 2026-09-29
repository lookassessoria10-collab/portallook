/**
 * Datas de calendário são tratadas como strings ISO `YYYY-MM-DD`, sem hora e sem
 * fuso. Assim "21/09/2026" nunca vira "20/09/2026" por conversão de timezone.
 * Carimbos de tempo (createdAt etc.) são ISO completos em UTC e só ganham fuso
 * na exibição (ver `formatDateTime`).
 */
export type Granularity = "month" | "week" | "custom";

export interface Period {
  start: string;
  end: string;
  granularity: Granularity;
}

export const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export const MONTHS_SHORT_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

export const WEEKDAYS_PT = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function parts(iso: string): [number, number, number] {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  return [+m[1], +m[2], +m[3]];
}

function toUTC(iso: string): Date {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function isoFromParts(year: number, month: number, day: number): string {
  return toISODate(new Date(Date.UTC(year, month - 1, day)));
}

export function addDays(iso: string, days: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** 1 = segunda … 7 = domingo (ISO-8601). */
export function isoWeekday(iso: string): number {
  const wd = toUTC(iso).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthPeriod(year: number, month: number): Period {
  return {
    start: isoFromParts(year, month, 1),
    end: isoFromParts(year, month, daysInMonth(year, month)),
    granularity: "month",
  };
}

export function weekPeriod(anyDayISO: string): Period {
  const start = startOfWeek(anyDayISO);
  return { start, end: addDays(start, 6), granularity: "week" };
}

export function periodKey(p: Period): string {
  if (p.granularity === "month") return p.start.slice(0, 7);
  if (p.granularity === "week") return p.start;
  return `${p.start}_${p.end}`;
}

export function parsePeriodKey(key: string): Period | null {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number);
    if (m < 1 || m > 12) return null;
    return monthPeriod(y, m);
  }
  if (isISODate(key)) return { start: key, end: addDays(key, 6), granularity: "week" };
  const custom = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (custom && isISODate(custom[1]) && isISODate(custom[2]) && custom[1] <= custom[2]) {
    return { start: custom[1], end: custom[2], granularity: "custom" };
  }
  return null;
}

export function previousPeriod(p: Period): Period {
  if (p.granularity === "month") {
    const [y, m] = parts(p.start);
    return m === 1 ? monthPeriod(y - 1, 12) : monthPeriod(y, m - 1);
  }
  if (p.granularity === "week") return weekPeriod(addDays(p.start, -7));
  const length = diffDays(p.end, p.start) + 1;
  return { start: addDays(p.start, -length), end: addDays(p.start, -1), granularity: "custom" };
}

export function nextPeriod(p: Period): Period {
  if (p.granularity === "month") {
    const [y, m] = parts(p.start);
    return m === 12 ? monthPeriod(y + 1, 1) : monthPeriod(y, m + 1);
  }
  if (p.granularity === "week") return weekPeriod(addDays(p.start, 7));
  const length = diffDays(p.end, p.start) + 1;
  return { start: addDays(p.end, 1), end: addDays(p.end, length), granularity: "custom" };
}

export function comparePeriods(a: Period, b: Period): number {
  return a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0;
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.start === b.start && a.end === b.end;
}

export function periodDays(p: Period): number {
  return diffDays(p.end, p.start) + 1;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = iso.slice(0, 10);
  if (!isISODate(date)) return "—";
  const [y, m, d] = parts(date);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "Setembro de 2026", "21 a 27 de setembro de 2026", "01/09/2026 a 15/09/2026". */
export function formatPeriod(p: Period, style: "long" | "short" | "compact" = "long"): string {
  const [sy, sm, sd] = parts(p.start);
  const [ey, em, ed] = parts(p.end);

  if (p.granularity === "month") {
    if (style === "compact") return cap(MONTHS_SHORT_PT[sm - 1]);
    if (style === "short") return `${MONTHS_SHORT_PT[sm - 1]}/${sy}`;
    return `${cap(MONTHS_PT[sm - 1])} de ${sy}`;
  }

  if (p.granularity === "week") {
    if (style === "compact") return `${String(sd).padStart(2, "0")}/${String(sm).padStart(2, "0")}`;
    if (style === "short") {
      return `${String(sd).padStart(2, "0")}/${String(sm).padStart(2, "0")} a ${String(ed).padStart(2, "0")}/${String(em).padStart(2, "0")}`;
    }
    if (sy !== ey) return `${sd} de ${MONTHS_PT[sm - 1]} de ${sy} a ${ed} de ${MONTHS_PT[em - 1]} de ${ey}`;
    if (sm !== em) return `${sd} de ${MONTHS_PT[sm - 1]} a ${ed} de ${MONTHS_PT[em - 1]} de ${ey}`;
    return `${sd} a ${ed} de ${MONTHS_PT[em - 1]} de ${ey}`;
  }

  if (style === "compact") return formatDate(p.start).slice(0, 5);
  return `${formatDate(p.start)} a ${formatDate(p.end)}`;
}

/** Forma usada em comparações: "vs. agosto", "vs. 14 a 20/09". */
export function formatPeriodReference(p: Period): string {
  const [, sm] = parts(p.start);
  if (p.granularity === "month") return MONTHS_PT[sm - 1];
  return formatPeriod(p, "short");
}

export function todayISO(timeZone = "America/Sao_Paulo", now: Date = new Date()): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(now);
}

export function formatDateTime(timestamp: string | null | undefined, timeZone = "America/Sao_Paulo"): string {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date} às ${time}`;
}

export function formatTimestampDate(timestamp: string | null | undefined, timeZone = "America/Sao_Paulo"): string {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** "há 3 dias", "hoje", "em 5 dias" relativos a hoje (datas de calendário). */
export function formatRelativeDays(iso: string, today: string): string {
  const diff = diffDays(iso, today);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return diff > 0 ? `em ${diff} dias` : `há ${-diff} dias`;
}
