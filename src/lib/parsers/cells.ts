import * as XLSX from "xlsx";
import { parseLocaleNumber } from "@/lib/format/number";
import { isoFromParts, isISODate } from "@/lib/dates/period";
import { normalizeText } from "@/lib/ids";
import type { CellValue } from "./types";

/**
 * Encontra a coluna pelo nome, tolerando acentos, caixa e variações
 * ("Investimento em mídia", "investimento", "Valor investido (R$)").
 */
export function findColumn(headers: string[], aliases: string[], exclude: Array<string | null> = []): string | null {
  const norm = headers.filter((h) => !exclude.includes(h)).map((h) => ({ h, n: normalizeText(h) }));
  const al = aliases.map(normalizeText);
  for (const a of al) {
    const exact = norm.find((x) => x.n === a);
    if (exact) return exact.h;
  }
  for (const a of al) {
    const starts = norm.find((x) => x.n.startsWith(`${a} `) || x.n.startsWith(a));
    if (starts) return starts.h;
  }
  for (const a of al) {
    if (a.length < 4) continue;
    const inc = norm.find((x) => x.n.includes(a));
    if (inc) return inc.h;
  }
  return null;
}

export function textCell(v: CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return toISO(v);
  const s = String(v).trim();
  return s ? s : null;
}

export interface NumberCell {
  value: number | null;
  invalid: boolean;
}

/** Número em formato brasileiro ou numérico nativo. Vazio/"-" = não informado. */
export function numberCell(v: CellValue): NumberCell {
  if (v === null || v === undefined) return { value: null, invalid: false };
  if (typeof v === "number") return Number.isFinite(v) ? { value: v, invalid: false } : { value: null, invalid: true };
  if (typeof v === "boolean" || v instanceof Date) return { value: null, invalid: true };
  const s = v.trim();
  // "-", "--" (Google Ads), "—" e afins = não informado.
  if (!s || /^[-–—\s]+$/.test(s) || /^(n\/?a|nd|não informado|nao informado)$/i.test(s)) return { value: null, invalid: false };
  // Moeda, % e "x" (multiplicador) são aceitos; outras letras ("1.5k", "12 mil") indicam valor que não dá para ler com segurança.
  if (/[a-zà-ú]/i.test(s.replace(/R\$|US\$|BRL|USD|EUR|€|\$|%/gi, "").replace(/x\s*$/i, ""))) return { value: null, invalid: true };
  const n = parseLocaleNumber(s);
  return n === null ? { value: null, invalid: true } : { value: n, invalid: false };
}

/** Percentuais podem vir como 0,0332 / 3,32 / "3,32%". Normaliza para fração. */
export function percentCell(v: CellValue): NumberCell {
  const n = numberCell(v);
  if (n.value === null) return n;
  if (typeof v === "string" && v.includes("%")) return n;
  return { value: Math.abs(n.value) > 1 ? n.value / 100 : n.value, invalid: false };
}

function toISO(d: Date): string {
  return isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

const MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1, january: 1,
  fev: 2, fevereiro: 2, feb: 2, february: 2,
  mar: 3, marco: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  mai: 5, maio: 5, may: 5,
  jun: 6, junho: 6, june: 6,
  jul: 7, julho: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, setembro: 9, sep: 9, sept: 9, september: 9,
  out: 10, outubro: 10, oct: 10, october: 10,
  nov: 11, novembro: 11, november: 11,
  dez: 12, dezembro: 12, dec: 12, december: 12,
};

function year(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function fromSerial(n: number): { y: number; m: number; d: number } | null {
  if (n < 20000 || n > 80000) return null;
  const p = XLSX.SSF.parse_date_code(n);
  return p ? { y: p.y, m: p.m, d: p.d } : null;
}

/** Data de calendário (AAAA-MM-DD) a partir de Date, número serial do Excel ou texto. */
export function dateCell(v: CellValue): string | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : toISO(v);
  if (typeof v === "number") {
    const p = fromSerial(v);
    return p ? isoFromParts(p.y, p.m, p.d) : null;
  }
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    const iso = isoFromParts(+m[1], +m[2], +m[3]);
    return isISODate(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`) ? iso : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) {
    const y = year(+m[3]);
    const candidate = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return isISODate(candidate) ? candidate : null;
  }
  return null;
}

/** Mês de referência: "2026-09", "09/2026", "set/26", "Setembro de 2026", datas… */
export function monthCell(v: CellValue): { year: number; month: number } | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : { year: v.getFullYear(), month: v.getMonth() + 1 };
  if (typeof v === "number") {
    const p = fromSerial(v);
    return p ? { year: p.y, month: p.m } : null;
  }
  const s = normalizeText(v).replace(/\bde\b/g, " ").replace(/\s+/g, " ").trim();
  let m = /^(\d{4})[ /.-](\d{1,2})$/.exec(s) ?? /^(\d{4}) (\d{1,2})$/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { year: +m[1], month: +m[2] };
  m = /^(\d{1,2})[ /.-](\d{4}|\d{2})$/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { year: year(+m[2]), month: +m[1] };
  m = /^([a-z]+)[ /.-]*(\d{4}|\d{2})$/.exec(s);
  if (m && MONTHS[m[1]]) return { year: year(+m[2]), month: MONTHS[m[1]] };
  const iso = dateCell(v);
  if (iso) return { year: +iso.slice(0, 4), month: +iso.slice(5, 7) };
  return null;
}

export function describeCell(v: CellValue): string {
  if (v instanceof Date) return toISO(v);
  return String(v ?? "").slice(0, 40);
}
