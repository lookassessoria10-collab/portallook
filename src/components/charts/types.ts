import type { ValueFormat } from "@/lib/format/number";

/** Ponto de série temporal serializável (vai do servidor para o cliente). */
export interface SeriesPoint {
  key: string;
  label: string;
  fullLabel: string;
  values: Record<string, number | null>;
}

export interface SeriesDef {
  key: string;
  label: string;
  format: ValueFormat;
  /** Cor da série: índice fixo na paleta categórica (1–5). */
  slot?: 1 | 2 | 3 | 4 | 5;
  /** Cor fixa (ex.: "Outros" em --chart-other); tem precedência sobre `slot`. */
  color?: string;
  description?: string;
}

export const SLOT_COLOR: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "var(--chart-1)",
  2: "var(--chart-2)",
  3: "var(--chart-3)",
  4: "var(--chart-4)",
  5: "var(--chart-5)",
};

export function seriesColor(series: Pick<SeriesDef, "slot" | "color">): string {
  return series.color ?? SLOT_COLOR[series.slot ?? 1];
}
