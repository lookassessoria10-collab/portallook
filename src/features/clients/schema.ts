import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/ids";
import { TimestampSchema } from "@/features/reports/schema";

export const CadenceSchema = z.enum(["monthly", "weekly"]);
export type Cadence = z.infer<typeof CadenceSchema>;

export const ModuleConfigSchema = z
  .object({
    enabled: z.boolean(),
    cadence: CadenceSchema,
    /** Mensal: dia do mês seguinte (1–28). Semanal: dia da semana seguinte (1 = segunda … 7 = domingo). */
    dueDay: z.number().int().min(1).max(28),
    allowOriginalDownload: z.boolean().default(false),
  })
  .refine((m) => m.cadence !== "weekly" || m.dueDay <= 7, {
    message: "Para entregas semanais, escolha um dia da semana.",
    path: ["dueDay"],
  });
export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;

/** Clientes cadastrados antes do módulo existir não têm a chave: entram com ele desativado. */
export const MEDIA_PLAN_MODULE_DEFAULT: ModuleConfig = { enabled: false, cadence: "monthly", dueDay: 1, allowOriginalDownload: false };

export const ClientStatusSchema = z.enum(["active", "inactive", "archived"]);
export type ClientStatus = z.infer<typeof ClientStatusSchema>;

export const DashboardConfigSchema = z.object({
  /** Convenção principal de retorno exibida ao cliente (os dashboards atuais usam as duas). */
  roiMetric: z.enum(["roas", "roiPercent"]).default("roas"),
  /** Métricas de destaque do resumo comercial, em ordem. Vazio = automático. */
  highlightMetrics: z.array(z.string()).default([]),
});
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;

export const ClientLogoSchema = z.object({
  path: z.string(),
  contentType: z.string(),
  updatedAt: TimestampSchema,
});

export const ClientSchema = z.object({
  id: z.string(),
  slug: z.string().regex(SLUG_PATTERN),
  name: z.string().trim().min(2).max(120),
  shortName: z.string().trim().min(1).max(60),
  /** Nome usado na saudação do portal ("Olá, Isabor"). */
  greetingName: z.string().trim().max(60).default(""),
  segment: z.string().trim().max(80).default(""),
  status: ClientStatusSchema,
  logo: ClientLogoSchema.nullable().default(null),
  currency: z.string().length(3).default("BRL"),
  modules: z.object({
    commercial: ModuleConfigSchema,
    traffic: ModuleConfigSchema,
    /** Plano de mídia: sempre mensal; o plano do mês vence no `dueDay` do próprio mês. */
    media_plan: ModuleConfigSchema.default(MEDIA_PLAN_MODULE_DEFAULT),
  }),
  dashboard: DashboardConfigSchema.default({ roiMetric: "roas", highlightMetrics: [] }),
  notes: z.string().max(4000).default(""),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  version: z.number().int().default(1),
});
export type Client = z.infer<typeof ClientSchema>;

export const ClientAccessSchema = z.object({
  clientId: z.string(),
  enabled: z.boolean(),
  token: z
    .object({
      /** HMAC-SHA256 do token — usado para validar o acesso. */
      hash: z.string(),
      /** Token cifrado (AES-256-GCM) — permite ao ADM copiar o link novamente. */
      ciphertext: z.string(),
      /** Últimos caracteres, para identificação visual. */
      hint: z.string(),
      createdAt: TimestampSchema,
    })
    .nullable(),
  updatedAt: TimestampSchema,
  history: z
    .array(
      z.object({
        action: z.enum(["generated", "revoked", "disabled", "enabled"]),
        at: TimestampSchema,
        hint: z.string().nullable().default(null),
      }),
    )
    .default([]),
});
export type ClientAccess = z.infer<typeof ClientAccessSchema>;

export const CADENCE_LABEL: Record<Cadence, string> = {
  monthly: "Mensal",
  weekly: "Semanal",
};
