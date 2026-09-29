import { normalizeText } from "@/lib/ids";
import type { InsightType } from "@/features/reports/schema";

export function mapInsightType(value: string | null): InsightType {
  const n = normalizeText(value ?? "");
  if (/positiv|destaque|bom|sucesso|resultado positivo/.test(n)) return "positive";
  if (/atenc|alerta|risco|warn|queda|problema/.test(n)) return "attention";
  if (/recomend|acao|sugest|proximo passo|rec\b/.test(n)) return "recommendation";
  return "neutral";
}
