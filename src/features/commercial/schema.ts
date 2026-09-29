import { z } from "zod";
import { PeriodSchema } from "@/features/reports/schema";

const Amount = z.number().finite();
const Count = z.number().finite().nonnegative();

/**
 * Funil dinâmico: cada cliente tem suas etapas. `value: null` significa
 * "não registrado" (diferente de zero) e é exibido como tal.
 */
export const FunnelStageSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  order: z.number().int(),
  value: Count.nullable(),
});
export type FunnelStage = z.infer<typeof FunnelStageSchema>;

export const FinancialSchema = z.object({
  revenue: Amount.nullable().default(null),
  mediaInvestment: Amount.nullable().default(null),
  sales: Count.nullable().default(null),
  attributedRevenue: Amount.nullable().default(null),
  otherCosts: Amount.nullable().default(null),
  /** Só usado quando não é possível calcular (receita ÷ vendas). */
  averageTicket: Amount.nullable().default(null),
});
export type Financial = z.infer<typeof FinancialSchema>;

export const ChannelKindSchema = z.enum(["paid", "organic", "referral", "recurring", "marketplace", "offline", "partner", "other"]);
export type ChannelKind = z.infer<typeof ChannelKindSchema>;

export const ChannelRowSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: ChannelKindSchema.default("other"),
  leads: Count.nullable().default(null),
  conversions: Count.nullable().default(null),
  revenue: Amount.nullable().default(null),
  investment: Amount.nullable().default(null),
});
export type ChannelRow = z.infer<typeof ChannelRowSchema>;

export const DimensionRowSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  leads: Count.nullable().default(null),
  conversions: Count.nullable().default(null),
  quantity: Count.nullable().default(null),
  revenue: Amount.nullable().default(null),
  note: z.string().max(200).nullable().default(null),
});
export type DimensionRow = z.infer<typeof DimensionRowSchema>;

/** Serviços, profissionais, unidades, procedimentos… sem código por cliente. */
export const DimensionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** Nome da medida "quantidade" para esta dimensão (ex.: "Atendimentos"). */
  quantityLabel: z.string().nullable().default(null),
  rows: z.array(DimensionRowSchema).min(1),
});
export type Dimension = z.infer<typeof DimensionSchema>;

export const ExtraMetricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: Amount.nullable(),
  format: z.enum(["integer", "decimal", "currency", "percent"]).default("integer"),
  direction: z.enum(["higherIsBetter", "lowerIsBetter", "neutral"]).default("neutral"),
  description: z.string().max(240).nullable().default(null),
});
export type ExtraMetric = z.infer<typeof ExtraMetricSchema>;

export const CommercialDataSchema = z.object({
  schemaVersion: z.literal(1),
  period: PeriodSchema,
  currency: z.string().length(3).default("BRL"),
  funnel: z.array(FunnelStageSchema).min(1, "O funil precisa de pelo menos uma etapa."),
  financial: FinancialSchema.nullable().default(null),
  channels: z.array(ChannelRowSchema).default([]),
  dimensions: z.array(DimensionSchema).default([]),
  extraMetrics: z.array(ExtraMetricSchema).default([]),
  /** Contexto do período (ex.: "Agenda reduzida em 16 dias"). */
  context: z.object({ title: z.string(), description: z.string().default("") }).nullable().default(null),
});
export type CommercialData = z.infer<typeof CommercialDataSchema>;
export type CommercialDataInput = z.input<typeof CommercialDataSchema>;
