import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { describeComparison, formatComparisonDelta, type Comparison } from "@/lib/metrics/comparison";
import { cn } from "@/lib/cn";

const sentimentClass = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-text-2",
};

/**
 * Variação vs. período anterior. A cor segue a direção desejável da métrica
 * (custo menor = verde), e sempre vem com seta + texto — nunca só cor.
 */
export function Delta({ comparison, reference, className, showReference = true }: { comparison: Comparison | null; reference?: string | null; className?: string; showReference?: boolean }) {
  if (!comparison || comparison.status === "unavailable") return null;
  const text = formatComparisonDelta(comparison);
  const Icon = comparison.status === "stable" ? Minus : comparison.trend === "up" ? ArrowUpRight : ArrowDownRight;
  const tone = comparison.status === "new" || comparison.status === "stable" ? "text-text-2" : sentimentClass[comparison.sentiment];
  return (
    <p className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] leading-tight", className)}>
      <span className={cn("inline-flex items-center gap-0.5 font-bold", tone)}>
        {comparison.status === "new" ? null : <Icon className="size-3.5" aria-hidden strokeWidth={2.5} />}
        <span className="tabular">{text}</span>
      </span>
      {showReference && reference ? <span className="text-text-3">vs. {reference}</span> : null}
      <span className="sr-only">{reference ? describeComparison(comparison, reference) : ""}</span>
    </p>
  );
}
