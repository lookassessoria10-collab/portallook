import type { ValueFormat } from "@/lib/format/number";
import type { ComparisonKind, MetricDirection } from "./comparison";

export interface MetricDefinition {
  key: string;
  label: string;
  /** Rótulo curto para cards pequenos e eixos. */
  shortLabel?: string;
  format: ValueFormat;
  direction: MetricDirection;
  comparison: ComparisonKind;
  /** Explicação exibida em tooltip / texto alternativo. */
  description: string;
}

function def(d: MetricDefinition): MetricDefinition {
  return d;
}

/**
 * Catálogo único de métricas. Os rótulos de funil (ex.: "Comparecimentos") são
 * dinâmicos e vêm dos dados; aqui ficam apenas as métricas com semântica fixa.
 */
export const METRICS = {
  // Comercial
  leads: def({ key: "leads", label: "Leads", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Contatos recebidos no período (primeira etapa do funil)." }),
  conversions: def({ key: "conversions", label: "Conversões", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Quantidade na etapa final do funil." }),
  conversionRate: def({ key: "conversionRate", label: "Taxa de conversão", shortLabel: "Conversão", format: "percent", direction: "higherIsBetter", comparison: "points", description: "Conversões finais ÷ leads." }),
  revenue: def({ key: "revenue", label: "Receita", format: "currency", direction: "higherIsBetter", comparison: "relative", description: "Receita total registrada no período." }),
  attributedRevenue: def({ key: "attributedRevenue", label: "Receita atribuída à mídia", shortLabel: "Receita atribuída", format: "currency", direction: "higherIsBetter", comparison: "relative", description: "Receita gerada por canais de mídia paga." }),
  investment: def({ key: "investment", label: "Investimento em mídia", shortLabel: "Investimento", format: "currency", direction: "neutral", comparison: "relative", description: "Valor investido em mídia paga no período." }),
  sales: def({ key: "sales", label: "Vendas", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Quantidade de vendas registradas." }),
  averageTicket: def({ key: "averageTicket", label: "Ticket médio", format: "currency", direction: "higherIsBetter", comparison: "relative", description: "Receita ÷ vendas (ou conversões finais)." }),
  cpl: def({ key: "cpl", label: "Custo por lead", shortLabel: "CPL", format: "currency", direction: "lowerIsBetter", comparison: "relative", description: "Investimento em mídia ÷ leads." }),
  cpa: def({ key: "cpa", label: "Custo por conversão", shortLabel: "CPA", format: "currency", direction: "lowerIsBetter", comparison: "relative", description: "Investimento em mídia ÷ conversões finais." }),
  roas: def({ key: "roas", label: "Retorno sobre mídia", shortLabel: "ROAS", format: "multiplier", direction: "higherIsBetter", comparison: "relative", description: "Receita atribuída ÷ investimento em mídia. 3,0x = R$ 3 para cada R$ 1 investido." }),
  roiPercent: def({ key: "roiPercent", label: "Retorno percentual", shortLabel: "ROI", format: "percent", direction: "higherIsBetter", comparison: "points", description: "(Receita atribuída − investimento) ÷ investimento." }),

  // Tráfego
  impressions: def({ key: "impressions", label: "Impressões", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Vezes em que os anúncios foram exibidos." }),
  reach: def({ key: "reach", label: "Alcance", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Pessoas únicas que viram os anúncios (soma por campanha)." }),
  clicks: def({ key: "clicks", label: "Cliques", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Cliques nos anúncios (cliques no link, quando é o dado disponível)." }),
  results: def({ key: "results", label: "Resultados", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Ações definidas como objetivo de cada campanha." }),
  costPerResult: def({ key: "costPerResult", label: "Custo por resultado", format: "currency", direction: "lowerIsBetter", comparison: "relative", description: "Investimento ÷ resultados." }),
  ctr: def({ key: "ctr", label: "CTR", format: "percent", direction: "higherIsBetter", comparison: "points", description: "Taxa de cliques: cliques ÷ impressões." }),
  cpc: def({ key: "cpc", label: "Custo por clique", shortLabel: "CPC", format: "currency", direction: "lowerIsBetter", comparison: "relative", description: "Investimento ÷ cliques." }),
  cpm: def({ key: "cpm", label: "CPM", format: "currency", direction: "lowerIsBetter", comparison: "relative", description: "Custo por mil impressões." }),
  frequency: def({ key: "frequency", label: "Frequência", format: "decimal", direction: "neutral", comparison: "relative", description: "Impressões ÷ alcance: média de vezes que cada pessoa viu o anúncio." }),
} satisfies Record<string, MetricDefinition>;

export type MetricKey = keyof typeof METRICS;

export function metric(key: MetricKey): MetricDefinition {
  return METRICS[key];
}
