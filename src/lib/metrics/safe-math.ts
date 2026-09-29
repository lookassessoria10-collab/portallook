import { isFiniteNumber } from "@/lib/format/number";

export type Maybe = number | null | undefined;

/** Divisão que devolve `null` para divisor zero/ausente — nunca NaN ou Infinity. */
export function safeDivide(numerator: Maybe, denominator: Maybe): number | null {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** Soma ignorando ausentes; `null` quando nenhum valor foi informado. */
export function sumMaybe(values: readonly Maybe[]): number | null {
  let total = 0;
  let found = false;
  for (const v of values) {
    if (isFiniteNumber(v)) {
      total += v;
      found = true;
    }
  }
  return found ? total : null;
}

/** Variação relativa: (atual − anterior) / |anterior|. */
export function relativeChange(current: Maybe, previous: Maybe): number | null {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function firstDefined(...values: Maybe[]): number | null {
  for (const v of values) if (isFiniteNumber(v)) return v;
  return null;
}
