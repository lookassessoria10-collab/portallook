import { z } from "zod";
import { IsoDateSchema, TimestampSchema } from "@/features/reports/schema";

/**
 * Status da ação — o mesmo no painel e no portal, na ordem do fluxo:
 * A apresentar → Aguardando aprovação → Aprovada → Em andamento / Aguardando retorno → Concluída, ou Não aprovada.
 * O status escolhido no painel decide sozinho em que seção do portal a ação aparece (ver `ACTION_STATUS_STAGE`).
 */
export const ACTION_STATUSES = ["planned", "suggested", "approved", "in_progress", "pending", "done", "rejected"] as const;
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
  /**
   * 1 = status como vieram da planilha (aprovadas já executadas, sugestões ainda a apresentar);
   * 2 = status revisados, valem como estão. Ver `upgradeActionStatus`.
   */
  statusModel: z.number().int().default(1),
  updatedAt: TimestampSchema,
  version: z.number().int().default(1),
});
export type ClientActions = z.infer<typeof ClientActionsSchema>;

/** Rótulos do status — os mesmos no painel e no portal. */
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  planned: "A apresentar",
  suggested: "Aguardando aprovação",
  approved: "Aprovada",
  in_progress: "Em andamento",
  // Ação já aprovada e em andamento, parada esperando algo do cliente (material, dado, ok de uma peça).
  pending: "Aguardando retorno",
  done: "Concluída",
  rejected: "Não aprovada",
};

export const ACTION_STATUS_TONE: Record<ActionStatus, "primary" | "attention" | "info" | "positive" | "neutral" | "negative" | "muted"> = {
  planned: "muted",
  suggested: "neutral",
  approved: "info",
  in_progress: "primary",
  pending: "attention",
  done: "positive",
  rejected: "negative",
};

/** Seções do portal (as etapas que o cliente vê), na ordem da página. */
export const ACTION_STAGES = ["planned", "suggested", "in_progress", "rejected", "done"] as const;
export type ActionStage = (typeof ACTION_STAGES)[number];

/** Em que seção do portal cada status aparece: aprovada e aguardando retorno ficam em "Em andamento". */
export const ACTION_STATUS_STAGE: Record<ActionStatus, ActionStage> = {
  planned: "planned",
  suggested: "suggested",
  approved: "in_progress",
  in_progress: "in_progress",
  pending: "in_progress",
  done: "done",
  rejected: "rejected",
};

export const ACTION_STAGE_LABEL: Record<ActionStage, string> = {
  planned: "Previstas",
  suggested: "Aguardando aprovação",
  in_progress: "Em andamento",
  rejected: "Não aprovadas",
  done: "Concluídas",
};

/**
 * Status da planilha → status revisado. A planilha marca como "Aprovado" ações já executadas e não
 * separa a sugestão ainda a apresentar; vale uma vez, para as ações que ainda não foram revisadas no painel:
 * - aprovada (ou sem status) com execução até hoje: concluída — ou em andamento, se for contínua;
 * - sem status com data de sugestão depois de hoje: a apresentar.
 */
export function upgradeActionStatus<T extends Pick<ClientAction, "status" | "kind" | "suggestedAt" | "executedAt">>(a: T, today: string): T {
  if ((a.status === "approved" || a.status === "suggested") && a.executedAt && a.executedAt <= today) return { ...a, status: a.kind === "continuous" ? "in_progress" : "done" };
  if (a.status === "suggested" && a.suggestedAt && a.suggestedAt > today) return { ...a, status: "planned" };
  return a;
}

export const ACTION_KIND_LABEL: Record<ActionKind, string> = { one_off: "Pontual", continuous: "Contínua" };

/** Status em texto livre → status do portal, com as mesmas regras (e a mesma ordem) da planilha. */
export function actionStatusFromText(value: string): ActionStatus {
  const t = value.trim().toLowerCase();
  if (!t || /sem status/.test(t)) return "suggested";
  if (/final|conclu/.test(t)) return "done";
  if (/a apresentar|previst/.test(t)) return "planned";
  if (/aguardando aprova/.test(t)) return "suggested";
  if (/aguardando retorno/.test(t)) return "pending";
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
