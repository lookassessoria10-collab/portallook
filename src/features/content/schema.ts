import { z } from "zod";
import { IsoDateSchema, TimestampSchema } from "@/features/reports/schema";

/** Situação do conteúdo na linguagem do cliente (os status do ClickUp são agrupados nestas cinco). */
export const CONTENT_STATUSES = ["planning", "production", "awaiting", "approved", "published"] as const;
export const ContentStatusSchema = z.enum(CONTENT_STATUSES);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  planning: "Em planejamento",
  production: "Em produção",
  awaiting: "Aguarda sua aprovação",
  approved: "Aprovado",
  published: "Publicado",
};

export const CONTENT_STATUS_TONE: Record<ContentStatus, "neutral" | "primary" | "attention" | "info" | "positive"> = {
  planning: "neutral",
  production: "primary",
  awaiting: "attention",
  approved: "info",
  published: "positive",
};

/** Tarefa da lista do ClickUp já normalizada — com tudo, inclusive o que o cliente não vê. */
export const ContentItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().nullable().default(null),
  /** Data de publicação (AAAA-MM-DD, no fuso do portal). */
  date: IsoDateSchema,
  /** "HH:MM" quando a tarefa tem horário. */
  time: z.string().nullable().default(null),
  statusName: z.string(),
  statusColor: z.string().nullable().default(null),
  statusType: z.string().nullable().default(null),
  /** Campos da lista, com o nome que vieram ("CARD E STORY", "INSTAGRAM/FACEBOOK", "CONTEÚDO"). */
  format: z.string().nullable().default(null),
  channel: z.string().nullable().default(null),
  type: z.string().nullable().default(null),
  caption: z.string().nullable().default(null),
  /** Descrição da tarefa: costuma misturar o texto do card com notas internas. */
  description: z.string().nullable().default(null),
  /** Etiquetas do campo "Andamento" (Postado, Agendado…). */
  progress: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const ContentRulesSchema = z.object({
  /** Valores do campo TIPO que aparecem (normalizados: sem acento, minúsculos). */
  types: z.array(z.string().trim().max(60)).max(30).default(["conteudo", "a pedido cliente"]),
  /** Esconde os itens chamados "TEMA" que ainda não têm legenda. */
  hidePlaceholders: z.boolean().default(true),
  /** Esconde itens com "(confirmar …)" no nome. */
  hideToConfirm: z.boolean().default(true),
  /** Esconde itens com a etiqueta "interno". */
  hideInternalTag: z.boolean().default(true),
  showCaption: z.boolean().default(true),
  showDescription: z.boolean().default(false),
  daysBack: z.number().int().min(0).max(180).default(30),
  daysAhead: z.number().int().min(7).max(365).default(90),
});
export type ContentRules = z.infer<typeof ContentRulesSchema>;

export const DEFAULT_CONTENT_RULES: ContentRules = ContentRulesSchema.parse({});

export const CLICKUP_LIST_ID = /^\d{1,20}$/;

/**
 * Documento `clients/{clientId}/content.json`. Enquanto não existe, valem os padrões:
 * área ligada, lista escolhida pelo nome do cliente e as regras acima.
 */
export const ContentSettingsSchema = z.object({
  clientId: z.string(),
  enabled: z.boolean().default(true),
  /** Lista escolhida no painel (null = automática, pelo nome do cliente). */
  listId: z.string().regex(CLICKUP_LIST_ID).nullable().default(null),
  rules: ContentRulesSchema.default(DEFAULT_CONTENT_RULES),
  updatedAt: TimestampSchema,
  version: z.number().int().default(1),
});
export type ContentSettings = z.infer<typeof ContentSettingsSchema>;

export const ContentStatusOptionSchema = z.object({ name: z.string(), color: z.string().nullable().default(null), type: z.string().nullable().default(null) });

/** Última leitura da lista (`clients/{clientId}/content-cache.json`). */
export const ContentCacheSchema = z.object({
  listId: z.string(),
  listName: z.string().nullable().default(null),
  from: IsoDateSchema,
  to: IsoDateSchema,
  fetchedAt: TimestampSchema,
  statuses: z.array(ContentStatusOptionSchema).default([]),
  /** Opções do campo TIPO na lista, com o nome que vieram. */
  typeOptions: z.array(z.string()).default([]),
  items: z.array(ContentItemSchema).max(3000).default([]),
  /** Última falha ao atualizar (os itens acima continuam valendo). */
  error: z.object({ at: TimestampSchema, message: z.string() }).nullable().default(null),
});
export type ContentCache = z.infer<typeof ContentCacheSchema>;

export const ClickUpListRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  folder: z.string().nullable().default(null),
  space: z.string().nullable().default(null),
});
export type ClickUpListRef = z.infer<typeof ClickUpListRefSchema>;

export const ClickUpListsCacheSchema = z.object({
  fetchedAt: TimestampSchema,
  /** Workspace lido (monta o link "Abrir no ClickUp"). */
  teamId: z.string().nullable().default(null),
  lists: z.array(ClickUpListRefSchema).max(5000),
});
export type ClickUpListsCache = z.infer<typeof ClickUpListsCacheSchema>;

/** O que o painel envia ao salvar. */
export const ContentSettingsInputSchema = z.object({
  enabled: z.boolean(),
  listId: z.string().regex(CLICKUP_LIST_ID).nullable(),
  rules: ContentRulesSchema,
});
export type ContentSettingsInput = z.input<typeof ContentSettingsInputSchema>;
