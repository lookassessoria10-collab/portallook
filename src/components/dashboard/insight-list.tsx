import { CircleCheck, Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { Insight, InsightType } from "@/features/reports/schema";
import { cn } from "@/lib/cn";

const TYPE: Record<InsightType, { label: string; icon: typeof Info; tone: string }> = {
  positive: { label: "Resultado positivo", icon: CircleCheck, tone: "text-positive bg-positive-soft" },
  attention: { label: "Ponto de atenção", icon: TriangleAlert, tone: "text-attention bg-attention-soft" },
  neutral: { label: "Contexto", icon: Info, tone: "text-text-2 bg-neutral-soft" },
  recommendation: { label: "Recomendação", icon: Lightbulb, tone: "text-primary bg-primary-soft" },
};

export function InsightList({ insights, className }: { insights: Insight[]; className?: string }) {
  if (!insights.length) return null;
  const order: InsightType[] = ["attention", "positive", "recommendation", "neutral"];
  const sorted = [...insights].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return (
    <ul className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-3", className)}>
      {sorted.map((insight) => {
        const t = TYPE[insight.type];
        const Icon = t.icon;
        return (
          <li key={insight.id} className="card flex gap-3 p-4">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", t.tone)} aria-hidden>
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text-3">
                {t.label}
                {insight.source === "auto" ? <span className="ml-1.5 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-text-2">gerado automaticamente</span> : null}
              </p>
              <h3 className="mt-0.5 text-[15px] font-bold leading-snug text-text">{insight.title}</h3>
              {insight.description ? <p className="mt-1 text-sm leading-relaxed text-text-2">{insight.description}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
