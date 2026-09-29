import { formatDecimal, formatPercent, isFiniteNumber } from "@/lib/format/number";
import { relativeChange, type Maybe } from "./safe-math";

/** Direção desejável da métrica: nem sempre subir é bom (ex.: custo por lead). */
export type MetricDirection = "higherIsBetter" | "lowerIsBetter" | "neutral";

/** `relative` compara em % (leads, receita); `points` em p.p. (taxas). */
export type ComparisonKind = "relative" | "points";

export type ComparisonStatus = "ok" | "new" | "stable" | "unavailable";

export interface Comparison {
  status: ComparisonStatus;
  kind: ComparisonKind;
  delta: number | null;
  trend: "up" | "down" | "flat";
  sentiment: "positive" | "negative" | "neutral";
  previous: number | null;
}

const FLAT_RELATIVE = 0.0005; // < 0,05%
const FLAT_POINTS = 0.0005; // < 0,05 p.p.

export function compareValues(
  current: Maybe,
  previous: Maybe,
  options: { direction: MetricDirection; kind?: ComparisonKind },
): Comparison {
  const kind = options.kind ?? "relative";
  const base: Comparison = {
    status: "unavailable",
    kind,
    delta: null,
    trend: "flat",
    sentiment: "neutral",
    previous: isFiniteNumber(previous) ? previous : null,
  };
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return base;

  let delta: number | null;
  if (kind === "points") {
    delta = current - previous;
  } else {
    if (previous === 0) {
      return current === 0 ? { ...base, status: "stable", delta: 0 } : { ...base, status: "new", trend: current > 0 ? "up" : "down" };
    }
    delta = relativeChange(current, previous);
  }
  if (delta === null) return base;

  const threshold = kind === "points" ? FLAT_POINTS : FLAT_RELATIVE;
  if (Math.abs(delta) < threshold) return { ...base, status: "stable", delta: 0 };

  const trend = delta > 0 ? "up" : "down";
  let sentiment: Comparison["sentiment"] = "neutral";
  if (options.direction === "higherIsBetter") sentiment = trend === "up" ? "positive" : "negative";
  if (options.direction === "lowerIsBetter") sentiment = trend === "down" ? "positive" : "negative";

  return { ...base, status: "ok", delta, trend, sentiment };
}

/** "+12,4%", "−4,1%", "+1,2 p.p.", "novo", "estável". */
export function formatComparisonDelta(c: Comparison): string {
  if (c.status === "new") return "novo";
  if (c.status === "stable") return "estável";
  if (c.status !== "ok" || c.delta === null) return "";
  const sign = c.delta > 0 ? "+" : "−";
  if (c.kind === "points") return `${sign}${formatDecimal(Math.abs(c.delta) * 100, 1)} p.p.`;
  return `${sign}${formatPercent(Math.abs(c.delta))}`;
}

/** Descrição acessível completa: "aumento de 12,4% em relação a agosto". */
export function describeComparison(c: Comparison, reference: string): string {
  if (c.status === "new") return `sem base de comparação em ${reference}`;
  if (c.status === "stable") return `estável em relação a ${reference}`;
  if (c.status !== "ok") return "";
  const verb = c.trend === "up" ? "aumento" : "redução";
  return `${verb} de ${formatComparisonDelta(c).replace(/^[+−]/, "")} em relação a ${reference}`;
}
