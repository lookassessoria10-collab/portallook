/**
 * Formatação numérica pt-BR. Toda função aceita `null`/`undefined`/não finitos
 * e devolve um traço — a interface nunca exibe NaN ou Infinity.
 */
export const EMPTY_VALUE = "—";

export type ValueFormat = "integer" | "decimal" | "currency" | "percent" | "multiplier" | "compact";

const cache = new Map<string, Intl.NumberFormat>();
function nf(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", options);
    cache.set(key, f);
  }
  return f;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatInteger(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  return nf("int", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  return nf(`dec${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "BRL",
  opts: { compact?: boolean; noCents?: boolean } = {},
): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  if (opts.compact && Math.abs(value) >= 10_000) {
    return nf(`curc-${currency}`, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  const digits = opts.noCents ? 0 : 2;
  return nf(`cur-${currency}-${digits}`, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace(/ /g, " ");
}

/** `ratio` é uma fração (0.0332 → "3,32%"). */
export function formatPercent(ratio: number | null | undefined, digits?: number): string {
  if (!isFiniteNumber(ratio)) return EMPTY_VALUE;
  const pct = ratio * 100;
  const d = digits ?? (Math.abs(pct) >= 100 ? 0 : 1);
  return `${nf(`pct${d}`, { minimumFractionDigits: d, maximumFractionDigits: d }).format(pct)}%`;
}

export function formatMultiplier(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${nf(`mul${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}x`;
}

export function formatCompact(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  if (Math.abs(value) < 10_000) return formatInteger(value);
  return nf("compact", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatValue(value: number | null | undefined, format: ValueFormat, currency = "BRL"): string {
  switch (format) {
    case "integer":
      return formatInteger(value);
    case "decimal":
      return formatDecimal(value);
    case "currency":
      return formatCurrency(value, currency);
    case "percent":
      return formatPercent(value);
    case "multiplier":
      return formatMultiplier(value);
    case "compact":
      return formatCompact(value);
  }
}

/** Versão curta para eixos e sparklines. */
export function formatAxisValue(value: number, format: ValueFormat, currency = "BRL"): string {
  if (!isFiniteNumber(value)) return "";
  if (format === "currency") {
    if (Math.abs(value) >= 1000) return formatCurrency(value, currency, { compact: true }).replace(/ /g, " ");
    return formatCurrency(value, currency, { noCents: true });
  }
  if (format === "percent") return formatPercent(value, 0);
  if (format === "multiplier") return formatMultiplier(value);
  return formatCompact(value);
}

/** Converte textos brasileiros ("R$ 1.234,56", "3,32%", "5.755") em número. */
export function parseLocaleNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s || s === "-" || s === "—" || /^n\/?a$/i.test(s)) return null;
  const isPercent = s.includes("%");
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/^[^\d-]+/, ""));
  s = s.replace(/[^\d.,-]/g, "").replace(/-/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // O último separador é o decimal.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Padrão brasileiro: vírgula única é decimal; várias vírgulas indicam milhar (formato en).
    const commaCount = (s.match(/,/g) ?? []).length;
    s = commaCount === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot > -1) {
    const dotCount = (s.match(/\./g) ?? []).length;
    const decimals = s.length - lastDot - 1;
    const integerPart = s.slice(0, lastDot);
    // "5.755" e "26.457" são milhares no padrão brasileiro; "0.125" e "3.32" são decimais.
    if (dotCount > 1 || (decimals === 3 && integerPart !== "0" && integerPart !== "")) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const signed = negative ? -n : n;
  return isPercent ? signed / 100 : signed;
}

/**
 * Valor de destaque (cards): compacta números grandes para caber no celular
 * ("R$ 139,6 mil", "R$ 26.000"), mantendo a precisão completa disponível no título.
 */
export function formatHeadlineValue(value: number | null | undefined, format: ValueFormat, currency = "BRL"): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  const abs = Math.abs(value);
  if (format === "currency") {
    if (abs >= 100_000) return formatCurrency(value, currency, { compact: true }).replace(/ /g, " ");
    if (abs >= 10_000) return formatCurrency(value, currency, { noCents: true });
    return formatCurrency(value, currency);
  }
  if (format === "integer" && abs >= 1_000_000) return formatCompact(value);
  return formatValue(value, format, currency);
}
