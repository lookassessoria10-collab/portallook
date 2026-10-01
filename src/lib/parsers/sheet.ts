import { MAX_ROWS_PER_SHEET, type CellValue, type RawRow, type RawSheet } from "./types";

function isEmpty(v: CellValue): boolean {
  return v === null || (typeof v === "string" && v.trim() === "");
}

function normalizeCell(v: unknown): CellValue {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  return String(v);
}

/**
 * Converte uma matriz (linhas × colunas) em aba com cabeçalho. O cabeçalho é a
 * primeira linha (entre as 10 primeiras) com pelo menos duas células de texto —
 * títulos decorativos acima da tabela são ignorados.
 */
/** `lineNumbers`: número real de cada linha da matriz na origem (ex.: linha do texto colado). */
export function matrixToSheet(name: string, matrix: unknown[][], lineNumbers?: number[]): RawSheet {
  const rows = matrix.slice(0, MAX_ROWS_PER_SHEET + 10).map((r) => (Array.isArray(r) ? r.map(normalizeCell) : []));
  let headerIndex = rows.findIndex((r, i) => i < 10 && r.filter((c) => typeof c === "string").length >= 2);
  if (headerIndex === -1) headerIndex = rows.findIndex((r) => r.some((c) => !isEmpty(c)));
  if (headerIndex === -1) return { name, headers: [], rows: [] };

  const seen = new Map<string, number>();
  const headers = rows[headerIndex].map((h, i) => {
    let label = typeof h === "string" ? h : h === null ? `Coluna ${i + 1}` : String(h instanceof Date ? h.toISOString().slice(0, 10) : h);
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    if (count) label = `${label} (${count + 1})`;
    return label;
  });

  const out: RawRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some((c) => !isEmpty(c))) continue;
    const cells: Record<string, CellValue> = {};
    headers.forEach((h, j) => (cells[h] = r[j] ?? null));
    out.push({ line: lineNumbers?.[i] ?? i + 1, cells });
  }
  return { name, headers, rows: out };
}
