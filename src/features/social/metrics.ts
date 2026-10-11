import { isFiniteNumber } from "@/lib/format/number";
import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";
import type { MetricDefinition } from "@/lib/metrics/definitions";
import type { ReportSummary } from "@/features/reports/schema";
import { NETWORK_LABEL, SOCIAL_METRIC_KEYS, type SocialData, type SocialMetricKey } from "./schema";

export type SocialDerivedKey = "netFollowers" | "engagementRate";
export type SocialKey = SocialMetricKey | SocialDerivedKey;

function def(d: MetricDefinition): MetricDefinition {
  return d;
}

/**
 * Catálogo das métricas de rede social. As descrições seguem o glossário da
 * planilha de análise de dados da Look e aparecem como explicação no portal.
 */
export const SOCIAL_METRICS: Record<SocialKey, MetricDefinition> = {
  followers: def({ key: "followers", label: "Seguidores", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Total de seguidores do perfil no fim do mês." }),
  newFollowers: def({ key: "newFollowers", label: "Novos seguidores", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Contas que começaram a seguir o perfil no mês." }),
  lostFollowers: def({ key: "lostFollowers", label: "Deixaram de seguir", shortLabel: "Perdas", format: "integer", direction: "lowerIsBetter", comparison: "relative", description: "Contas que deixaram de seguir o perfil no mês." }),
  netFollowers: def({ key: "netFollowers", label: "Saldo de seguidores", shortLabel: "Saldo", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Novos seguidores menos os que deixaram de seguir no mês." }),
  reach: def({ key: "reach", label: "Alcance", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Contas únicas que viram o conteúdo pelo menos uma vez no mês, inclusive por anúncios." }),
  views: def({ key: "views", label: "Visualizações", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Vezes em que publicações, stories, reels e vídeos apareceram na tela, inclusive em anúncios." }),
  engagement: def({ key: "engagement", label: "Engajamento", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Contas que interagiram com o conteúdo no mês, inclusive por anúncios." }),
  engagementRate: def({ key: "engagementRate", label: "Taxa de engajamento", shortLabel: "Engajamento", format: "percent", direction: "higherIsBetter", comparison: "points", description: "Engajamento ÷ alcance: das contas alcançadas, quantas interagiram com o conteúdo." }),
  profileVisits: def({ key: "profileVisits", label: "Visitas ao perfil", shortLabel: "Visitas", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Vezes em que o perfil foi acessado." }),
  interactions: def({ key: "interactions", label: "Interações", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Total de interações com publicações, stories, reels e vídeos (curtidas, comentários, salvamentos, compartilhamentos…), inclusive em conteúdo turbinado." }),
  likes: def({ key: "likes", label: "Curtidas", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Curtidas em publicações, reels e vídeos." }),
  comments: def({ key: "comments", label: "Comentários", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Comentários em publicações, reels e vídeos." }),
  saves: def({ key: "saves", label: "Salvamentos", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Vezes em que publicações, reels e vídeos foram salvos." }),
  shares: def({ key: "shares", label: "Compartilhamentos", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Vezes em que o conteúdo foi compartilhado." }),
  linkClicks: def({ key: "linkClicks", label: "Toques em links", format: "integer", direction: "higherIsBetter", comparison: "relative", description: "Toques nos links do perfil (site, WhatsApp, agendamento)." }),
};

/** Rótulo da métrica: o que veio na planilha ("Impressões", "Toque no site") ou o padrão do portal. */
export function socialLabel(key: string, labels: Readonly<Record<string, string>>): string {
  return labels[key] ?? SOCIAL_METRICS[key as SocialKey]?.label ?? key;
}

export interface InteractionSlice {
  key: "likes" | "comments" | "saves" | "shares" | "other";
  label: string;
  value: number;
  share: number | null;
}

export interface SocialMetricsView {
  values: Record<SocialKey, number | null>;
  /** Composição das interações (curtidas, comentários, salvamentos, compartilhamentos e outras). */
  interactionSlices: InteractionSlice[];
}

const SLICES = ["likes", "comments", "saves", "shares"] as const;

export function computeSocialMetrics(data: SocialData): SocialMetricsView {
  const m = data.metrics;
  const values = { ...m } as Record<SocialKey, number | null>;
  values.netFollowers = isFiniteNumber(m.newFollowers) && isFiniteNumber(m.lostFollowers) ? m.newFollowers - m.lostFollowers : null;
  values.engagementRate = safeDivide(m.engagement, m.reach);

  const parts = SLICES.filter((k) => isFiniteNumber(m[k])).map((k) => ({ key: k, label: SOCIAL_METRICS[k].label, value: m[k] as number }));
  const partsTotal = sumMaybe(parts.map((p) => p.value));
  // "Outras": stories respondidos, repostagens… — o que a planilha conta em Interações além das quatro principais.
  const other = isFiniteNumber(m.interactions) && partsTotal !== null && m.interactions > partsTotal ? m.interactions - partsTotal : 0;
  const slices: InteractionSlice[] = [...parts, ...(other > 0 ? [{ key: "other" as const, label: "Outras interações", value: other }] : [])].map((s) => ({ ...s, share: null }));
  const base = Math.max(m.interactions ?? 0, sumMaybe(slices.map((s) => s.value)) ?? 0);
  for (const s of slices) s.share = safeDivide(s.value, base);
  return { values, interactionSlices: slices };
}

/** Indicadores gravados no índice: alimentam a comparação, a evolução e a visão geral sem abrir o data.json. */
export function socialSummary(data: SocialData): { summary: ReportSummary; labels: Record<string, string> } {
  const { values } = computeSocialMetrics(data);
  const summary: ReportSummary = {};
  for (const key of [...SOCIAL_METRIC_KEYS, "netFollowers", "engagementRate"] as SocialKey[]) summary[key] = values[key];
  const labels: Record<string, string> = { network: NETWORK_LABEL[data.network], ...data.labels };
  for (const e of data.extraMetrics) {
    summary[`extra.${e.key}`] = e.value;
    labels[`extra.${e.key}`] = e.label;
  }
  return { summary, labels };
}
