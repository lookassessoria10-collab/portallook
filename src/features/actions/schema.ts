import { z } from "zod";
import { IsoDateSchema, TimestampSchema } from "@/features/reports/schema";

/**
 * Leitura de status da planilha de ações ("Leitura de status" da aba Base Dashboard):
 * Sem status · Aprovada · Em andamento · Pendência · Concluída · Não aprovada.
 */
export const ACTION_STATUSES = ["in_progress", "pending", "approved", "done", "suggested", "rejected"] as const;
export const ActionStatusSchema = z.enum(ACTION_STATUSES);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const ActionKindSchema = z.enum(["one_off", "continuous"]);
export type ActionKind = z.infer<typeof ActionKindSchema>;

export const ACTION_ID_PATTERN = /^ac_[0-9a-z]{6,32}$/;

export const ClientActionSchema = z.object({
  id: z.string().regex(ACTION_ID_PATTERN),
  title: z.string().trim().min(2).max(300),
  /** Frente da ação — o termo entre parênteses na planilha ("Institucional", "Captação"…). */
  category: z.string().trim().max(60).default(""),
  kind: ActionKindSchema.nullable().default(null),
  status: ActionStatusSchema.default("suggested"),
  suggestedAt: IsoDateSchema.nullable().default(null),
  executedAt: IsoDateSchema.nullable().default(null),
  /** "Última atualização" da planilha. */
  lastUpdateAt: IsoDateSchema.nullable().default(null),
  /** "Andamento / Pendências" — interno, não aparece para o cliente. */
  progress: z.string().trim().max(2000).default(""),
  /** "Observações" — interno, não aparece para o cliente. */
  notes: z.string().trim().max(2000).default(""),
  /** Texto escrito para o cliente, exibido no portal junto da ação. */
  clientNote: z.string().trim().max(1000).default(""),
  /** Falso = a ação fica só no painel da Look. */
  visible: z.boolean().default(true),
});
export type ClientAction = z.infer<typeof ClientActionSchema>;

export const MAX_ACTIONS = 500;

/**
 * Documento `clients/{clientId}/actions.json`. Enquanto não existe, o cliente usa as ações
 * da aba correspondente na planilha (snapshot no código); a 1ª edição no painel grava o documento.
 */
export const ClientActionsSchema = z.object({
  clientId: z.string(),
  /** Mostrar a área "Ações" no portal do cliente. */
  enabled: z.boolean().default(true),
  /** Aba da planilha de onde as ações vieram (null = cadastradas só no painel). */
  source: z.object({ sheet: z.string(), extractedAt: z.string() }).nullable().default(null),
  items: z.array(ClientActionSchema).max(MAX_ACTIONS).default([]),
  updatedAt: TimestampSchema,
  version: z.number().int().default(1),
});
export type ClientActions = z.infer<typeof ClientActionsSchema>;

/** Rótulos do painel da Look (os mesmos da planilha). */
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  in_progress: "Em andamento",
  pending: "Pendência",
  approved: "Aprovada",
  done: "Concluída",
  suggested: "Sem status",
  rejected: "Não aprovada",
};

/** Rótulos do portal: para o cliente, uma ação sem status é uma sugestão da Look. */
export const ACTION_STATUS_CLIENT_LABEL: Record<ActionStatus, string> = {
  in_progress: "Em andamento",
  pending: "Pendente",
  approved: "Aprovada",
  done: "Concluída",
  suggested: "Sugerida",
  rejected: "Não aprovada",
};

export const ACTION_STATUS_TONE: Record<ActionStatus, "primary" | "attention" | "info" | "positive" | "neutral" | "negative"> = {
  in_progress: "primary",
  pending: "attention",
  approved: "info",
  done: "positive",
  suggested: "neutral",
  rejected: "negative",
};

export const ACTION_KIND_LABEL: Record<ActionKind, string> = { one_off: "Pontual", continuous: "Contínua" };

/** Status em texto livre → status do portal, com as mesmas regras (e a mesma ordem) da planilha. */
export function actionStatusFromText(value: string): ActionStatus {
  const t = value.trim().toLowerCase();
  if (!t) return "suggested";
  if (/final|conclu/.test(t)) return "done";
  if (/não aprov|nao aprov|arquiv/.test(t)) return "rejected";
  if (/andamento|em produção|em producao|agendada|ativo/.test(t)) return "in_progress";
  if (/^aprova/.test(t)) return "approved";
  if (/aguard|pend|bloque|a fazer/.test(t)) return "pending";
  return "suggested";
}

export function actionKindFromText(value: string): ActionKind | null {
  const t = value.trim().toLowerCase();
  if (/^cont[ií]nu/.test(t)) return "continuous";
  if (/^pontua/.test(t)) return "one_off";
  return null;
}

/** "Blog educativo para fortalecer autoridade (Autoridade)" → título e frente. */
export function splitActionTitle(value: string): { title: string; category: string } {
  const text = value.replace(/\s+/g, " ").trim();
  const m = text.match(/^(.*\S)\s*\(([^()]{2,60})\)$/);
  return m ? { title: m[1], category: m[2].trim() } : { title: text, category: "" };
}

/** Dados que o formulário do painel envia (datas vazias = sem data). */
const optionalDate = z
  .string()
  .trim()
  .nullable()
  .transform((v) => v || null)
  .pipe(IsoDateSchema.nullable());

export const ActionInputSchema = z.object({
  id: z.string().regex(ACTION_ID_PATTERN).optional(),
  title: z.string().trim().min(2, "Descreva a ação.").max(300),
  category: z.string().trim().max(60).default(""),
  kind: ActionKindSchema.nullable().default(null),
  status: ActionStatusSchema,
  suggestedAt: optionalDate.default(null),
  executedAt: optionalDate.default(null),
  lastUpdateAt: optionalDate.default(null),
  progress: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(2000).default(""),
  clientNote: z.string().trim().max(1000).default(""),
  visible: z.boolean().default(true),
});
export type ActionInput = z.input<typeof ActionInputSchema>;
