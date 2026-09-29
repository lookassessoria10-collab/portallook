import { z } from "zod";
import { PeriodSchema } from "@/features/reports/schema";

const Amount = z.number().finite().nonnegative();

export const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
  linkedin_ads: "LinkedIn Ads",
  youtube_ads: "YouTube Ads",
  other: "Outras plataformas",
};

export const PLATFORM_ORDER = ["meta_ads", "google_ads", "tiktok_ads", "linkedin_ads", "youtube_ads", "other"];

export const ResultTypeSchema = z.enum(["whatsapp", "lead", "form", "purchase", "appointment", "call", "conversion", "visit", "other"]);
export type ResultType = z.infer<typeof ResultTypeSchema>;

export const RESULT_TYPE_LABEL: Record<ResultType, { singular: string; plural: string }> = {
  whatsapp: { singular: "Conversa no WhatsApp", plural: "Conversas no WhatsApp" },
  lead: { singular: "Lead", plural: "Leads" },
  form: { singular: "Formulário", plural: "Formulários" },
  purchase: { singular: "Compra", plural: "Compras" },
  appointment: { singular: "Agendamento", plural: "Agendamentos" },
  call: { singular: "Ligação", plural: "Ligações" },
  conversion: { singular: "Conversão", plural: "Conversões" },
  visit: { singular: "Visita", plural: "Visitas" },
  other: { singular: "Resultado", plural: "Resultados" },
};

export const CampaignSchema = z.object({
  id: z.string().min(1),
  platform: z.string().min(1),
  name: z.string().min(1),
  objective: z.string().nullable().default(null),
  investment: Amount,
  impressions: Amount,
  reach: Amount.nullable().default(null),
  clicks: Amount.nullable().default(null),
  linkClicks: Amount.nullable().default(null),
  results: Amount.nullable().default(null),
  resultType: ResultTypeSchema.nullable().default(null),
  /** Rótulo livre quando o tipo é "other" (ex.: "Cadastros no evento"). */
  resultLabel: z.string().nullable().default(null),
  conversions: Amount.nullable().default(null),
  attributedRevenue: Amount.nullable().default(null),
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const TrafficDataSchema = z.object({
  schemaVersion: z.literal(1),
  period: PeriodSchema,
  currency: z.string().length(3).default("BRL"),
  campaigns: z.array(CampaignSchema).min(1, "O relatório precisa de pelo menos uma campanha."),
});
export type TrafficData = z.infer<typeof TrafficDataSchema>;
export type TrafficDataInput = z.input<typeof TrafficDataSchema>;

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

export function resultTypeLabel(type: ResultType | null, count = 2, custom?: string | null): string {
  if (custom) return custom;
  const t = RESULT_TYPE_LABEL[type ?? "other"];
  return count === 1 ? t.singular : t.plural;
}
