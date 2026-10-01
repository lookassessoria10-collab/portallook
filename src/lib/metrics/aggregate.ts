import { isFiniteNumber } from "@/lib/format/number";
import { safeDivide } from "./safe-math";

/**
 * Agregação de indicadores de vários períodos (ex.: resumos do índice).
 * Taxas nunca são somadas nem tiradas por média simples: são recalculadas a
 * partir das partes, considerando só os períodos em que as duas partes existem.
 */
export type ValueRow = Readonly<Record<string, number | null | undefined>>;

/** Soma de uma chave; `null` quando nenhum período informou o valor. */
export function sumKey(rows: readonly ValueRow[], key: string): number | null {
  let total = 0;
  let found = false;
  for (const r of rows) {
    const v = r[key];
    if (isFiniteNumber(v)) {
      total += v;
      found = true;
    }
  }
  return found ? total : null;
}

/** Σ numerador ÷ Σ denominador (ex.: conversões ÷ leads). */
export function ratioOfSums(rows: readonly ValueRow[], numKey: string, denKey: string): number | null {
  let num = 0;
  let den = 0;
  let found = false;
  for (const r of rows) {
    const n = r[numKey];
    const d = r[denKey];
    if (isFiniteNumber(n) && isFiniteNumber(d)) {
      num += n;
      den += d;
      found = true;
    }
  }
  return found ? safeDivide(num, den) : null;
}

/** Média de uma razão ponderada pela sua base: Σ(razão × base) ÷ Σ base (ex.: custo por resultado × resultados). */
export function weightedRatio(rows: readonly ValueRow[], ratioKey: string, weightKey: string): number | null {
  let num = 0;
  let den = 0;
  let found = false;
  for (const r of rows) {
    const ratio = r[ratioKey];
    const weight = r[weightKey];
    if (isFiniteNumber(ratio) && isFiniteNumber(weight)) {
      num += ratio * weight;
      den += weight;
      found = true;
    }
  }
  return found ? safeDivide(num, den) : null;
}

/** Σ numerador ÷ Σ(numerador ÷ razão) — recupera o denominador implícito (ex.: CTR a partir de cliques). */
export function inverseWeightedRatio(rows: readonly ValueRow[], numKey: string, ratioKey: string): number | null {
  let num = 0;
  let den = 0;
  let found = false;
  for (const r of rows) {
    const n = r[numKey];
    const ratio = r[ratioKey];
    if (isFiniteNumber(n) && isFiniteNumber(ratio) && ratio !== 0) {
      num += n;
      den += n / ratio;
      found = true;
    }
  }
  return found ? safeDivide(num, den) : null;
}

/** Média por período com valor informado (ex.: investimento médio por mês). */
export function averageKey(rows: readonly ValueRow[], key: string): number | null {
  const values = rows.map((r) => r[key]).filter(isFiniteNumber);
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}
