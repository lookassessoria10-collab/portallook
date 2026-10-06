import { z } from "zod";
import { IsoDateSchema, PeriodSchema } from "@/features/reports/schema";
import { ResultTypeSchema } from "@/features/traffic/schema";

const Amount = z.number().finite().nonnegative();

/**
 * Uma campanha ou ação planejada. `platform` é a chave da plataforma (meta_ads,
 * google_ads…) quando reconhecida, ou o nome do veículo como veio ("Rádio") — o
 * mesmo padrão do tráfego, o que permite comparar o planejado com o realizado.
 */
export const MediaPlanItemSchema = z
  .object({
    id: z.string().min(1),
    platform: z.string().min(1),
    name: z.string().min(1),
    objective: z.string().nullable().default(null),
    /** Etapa do funil ("Topo", "Meio / fundo"). */
    funnel: z.string().nullable().default(null),
    audience: z.string().nullable().default(null),
    /** Ofertas, serviços ou produtos anunciados. */
    offers: z.string().nullable().default(null),
    format: z.string().nullable().default(null),
    start: IsoDateSchema.nullable().default(null),
    end: IsoDateSchema.nullable().default(null),
    budget: Amount,
    dailyBudget: Amount.nullable().default(null),
    /** Resultado esperado: tipo (Leads, WhatsApp…) e meta numérica. */
    resultType: ResultTypeSchema.nullable().default(null),
    resultLabel: z.string().nullable().default(null),
    resultTarget: Amount.nullable().default(null),
    /** Custo por resultado esperado — quando não informado, é verba ÷ meta. */
    costPerResultTarget: Amount.nullable().default(null),
    impressionsTarget: Amount.nullable().default(null),
    reachTarget: Amount.nullable().default(null),
    clicksTarget: Amount.nullable().default(null),
    notes: z.string().max(1000).nullable().default(null),
  })
  .refine((i) => !i.start || !i.end || i.start <= i.end, "A data de início precisa ser anterior à de fim.");
export type MediaPlanItem = z.infer<typeof MediaPlanItemSchema>;

/**
 * Indicador do plano (resumo ou meta). `value` é o número quando dá para ler;
 * `display` guarda o texto como foi escrito quando ele não é um número só
 * ("60–125", "≥ 30%", "R$ 12–25") — exibido exatamente assim.
 */
export const MediaPlanFigureSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number().finite().nullable(),
  display: z.string().max(60).nullable().default(null),
  format: z.enum(["integer", "decimal", "currency", "percent"]).default("integer"),
  description: z.string().max(300).nullable().default(null),
});
export type MediaPlanFigure = z.infer<typeof MediaPlanFigureSchema>;

/** Tipos de bloco de texto das seções livres do plano (direção, passos, mensagens, compliance…). */
export const BLOCK_KINDS = ["text", "callout", "card", "step", "item", "quote", "warning", "phase", "table"] as const;
export const MediaPlanBlockSchema = z.object({
  kind: z.enum(BLOCK_KINDS),
  title: z.string().max(200).nullable().default(null),
  text: z.string().max(3000).default(""),
  /** Etiqueta curta (ex.: "R$ 50/dia" num cartão). */
  tag: z.string().max(60).nullable().default(null),
  /** Só em `table`: cabeçalho e linhas, como vieram do arquivo. */
  columns: z.array(z.string()).default([]),
  rows: z.array(z.array(z.string())).default([]),
});
export type MediaPlanBlock = z.infer<typeof MediaPlanBlockSchema>;

export const MediaPlanSectionSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1).max(140),
  /** "top": logo depois do resumo (ex.: direção executiva); "bottom": depois das campanhas. */
  placement: z.enum(["top", "bottom"]).default("bottom"),
  blocks: z.array(MediaPlanBlockSchema).min(1),
});
export type MediaPlanSection = z.infer<typeof MediaPlanSectionSchema>;

export const MediaPlanDataSchema = z.object({
  schemaVersion: z.literal(1),
  period: PeriodSchema,
  currency: z.string().length(3).default("BRL"),
  /** Apresentação do plano: título, chamada, resumo e etiquetas. */
  header: z
    .object({
      title: z.string().max(160).nullable().default(null),
      tagline: z.string().max(160).nullable().default(null),
      summary: z.string().max(1500).nullable().default(null),
      tags: z.array(z.string().max(60)).default([]),
      updatedAt: IsoDateSchema.nullable().default(null),
    })
    .nullable()
    .default(null),
  /** Números de destaque do resumo (orçamento-base, verba diária…). Vazio = calculados pelo sistema. */
  highlights: z.array(MediaPlanFigureSchema).default([]),
  items: z.array(MediaPlanItemSchema).min(1, "O plano precisa de pelo menos uma campanha ou ação."),
  /** Observação de cada plataforma no orçamento ("R$ 50/dia durante 30 dias, com destino ao WhatsApp"). */
  platforms: z.array(z.object({ platform: z.string().min(1), description: z.string().max(500) })).default([]),
  goals: z.array(MediaPlanFigureSchema).default([]),
  sections: z.array(MediaPlanSectionSchema).default([]),
});
export type MediaPlanData = z.infer<typeof MediaPlanDataSchema>;
export type MediaPlanDataInput = z.input<typeof MediaPlanDataSchema>;
