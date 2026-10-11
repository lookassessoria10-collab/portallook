import { z } from "zod";
import { PeriodSchema } from "@/features/reports/schema";

const Count = z.number().finite().nonnegative().nullable().default(null);

/** Rede do relatório: vem do título da aba ("ANÁLISE DE DADOS - INSTAGRAM"); sem título, Instagram. */
export const SOCIAL_NETWORKS = ["instagram", "facebook", "tiktok", "linkedin", "youtube", "other"] as const;
export const SocialNetworkSchema = z.enum(SOCIAL_NETWORKS);
export type SocialNetwork = z.infer<typeof SocialNetworkSchema>;

export const NETWORK_LABEL: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  other: "Rede social",
};

/**
 * Métricas do mês, como vêm da planilha de análise de dados (uma linha por mês).
 * `null` = não informado (ex.: "Visitas" deixou de vir do Instagram), diferente de zero.
 * Seguidores é o total no fim do mês; as demais são contagens do próprio mês.
 */
export const SocialMetricsSchema = z.object({
  followers: Count,
  newFollowers: Count,
  lostFollowers: Count,
  reach: Count,
  /** Visualizações (antes "Impressões" no Instagram) — o rótulo usado na planilha fica em `labels.views`. */
  views: Count,
  /** Contas engajadas: contas que interagiram com o conteúdo. */
  engagement: Count,
  profileVisits: Count,
  interactions: Count,
  likes: Count,
  comments: Count,
  saves: Count,
  shares: Count,
  /** Toques em links / toque no site — o rótulo usado na planilha fica em `labels.linkClicks`. */
  linkClicks: Count,
});
export type SocialMetrics = z.infer<typeof SocialMetricsSchema>;
export type SocialMetricKey = keyof SocialMetrics;

export const SOCIAL_METRIC_KEYS = Object.keys(SocialMetricsSchema.shape) as SocialMetricKey[];

/** Coluna numérica que o portal não conhece (ex.: "Publicações", "Stories"): aparece com o nome que veio. */
export const SocialExtraMetricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1).max(80),
  value: z.number().finite().nullable(),
});
export type SocialExtraMetric = z.infer<typeof SocialExtraMetricSchema>;

export const SocialDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    period: PeriodSchema,
    network: SocialNetworkSchema.default("instagram"),
    metrics: SocialMetricsSchema,
    /** Rótulos como vieram na planilha, quando variam entre clientes ("Impressões" × "Visualizações"). */
    labels: z.record(z.string(), z.string().max(80)).default({}),
    extraMetrics: z.array(SocialExtraMetricSchema).default([]),
  })
  .refine((d) => SOCIAL_METRIC_KEYS.some((k) => d.metrics[k] !== null) || d.extraMetrics.some((e) => e.value !== null), "O mês precisa de pelo menos uma métrica preenchida.");
export type SocialData = z.infer<typeof SocialDataSchema>;
export type SocialDataInput = z.input<typeof SocialDataSchema>;
