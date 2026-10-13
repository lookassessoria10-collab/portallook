import type { ValueFormat } from "@/lib/format/number";
import type { Comparison } from "@/lib/metrics/comparison";

/** Indicador de destaque dos painéis (tráfego, rede social, plano de mídia). */
export interface KpiView {
  key: string;
  label: string;
  value: number | null;
  format: ValueFormat;
  comparison: Comparison | null;
  trend: Array<number | null>;
  description: string;
  footnote?: string | null;
  icon: KpiIcon;
}

export type KpiIcon = "leads" | "conversions" | "revenue" | "investment" | "roas" | "rate" | "ticket" | "cost" | "sales" | "followers" | "newFollowers" | "reach" | "views" | "engagement" | "interactions" | "visits" | "clicks";
