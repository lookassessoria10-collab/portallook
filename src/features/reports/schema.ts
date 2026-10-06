import { z } from "zod";
import { isISODate } from "@/lib/dates/period";

export const IsoDateSchema = z.string().refine(isISODate, "Data inválida (use AAAA-MM-DD).");
export const TimestampSchema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Data/hora inválida.");

export const PeriodSchema = z
  .object({
    start: IsoDateSchema,
    end: IsoDateSchema,
    granularity: z.enum(["month", "week", "custom"]),
  })
  .refine((p) => p.start <= p.end, "O início do período precisa ser anterior ao fim.");

export const ReportTypeSchema = z.enum(["commercial", "traffic", "media_plan"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

/** Ordem das áreas no painel e no portal. */
export const REPORT_TYPES: readonly ReportType[] = ["commercial", "traffic", "media_plan"];

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  commercial: "Comercial",
  traffic: "Tráfego",
  media_plan: "Plano de mídia",
};

/** Segmento de URL de cada área: aba do cliente no ADM e parâmetro `aba` do portal. */
export const REPORT_TYPE_PATH: Record<ReportType, string> = {
  commercial: "comercial",
  traffic: "trafego",
  media_plan: "plano-de-midia",
};

/** Lê `aba`/`tipo` aceitando o segmento da URL ("trafego") ou o identificador interno ("traffic"). */
export function reportTypeFromParam(value: string | null | undefined): ReportType | null {
  if (!value) return null;
  const parsed = ReportTypeSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return REPORT_TYPES.find((t) => REPORT_TYPE_PATH[t] === value) ?? null;
}

export const ReportKindSchema = z.enum(["dataset", "document"]);
export type ReportKind = z.infer<typeof ReportKindSchema>;

/**
 * draft → published → unpublished (retirado pelo ADM)
 *                   → superseded (substituído por nova versão do mesmo período)
 * qualquer → archived (fora das listas, mas preservado)
 */
export const ReportStatusSchema = z.enum(["draft", "published", "unpublished", "superseded", "archived"]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const SourceTypeSchema = z.enum(["xlsx", "xls", "csv", "md", "pdf", "html_structured", "html_legacy", "seed"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  xlsx: "Excel",
  xls: "Excel",
  csv: "CSV",
  md: "Dados colados",
  pdf: "PDF",
  html_structured: "HTML estruturado",
  html_legacy: "HTML",
  seed: "Dados de demonstração",
};

export const InsightTypeSchema = z.enum(["positive", "attention", "neutral", "recommendation"]);
export type InsightType = z.infer<typeof InsightTypeSchema>;

export const InsightSchema = z.object({
  id: z.string().min(1),
  type: InsightTypeSchema,
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1500).default(""),
  /** `manual`/`import` foram escritos pela Look; `auto` é gerado pelo sistema e sempre sinalizado. */
  source: z.enum(["manual", "import", "auto"]).default("manual"),
});
export type Insight = z.infer<typeof InsightSchema>;

export const ValidationIssueSchema = z.object({
  level: z.enum(["error", "warning"]),
  code: z.string(),
  message: z.string(),
  location: z
    .object({
      sheet: z.string().optional(),
      row: z.number().int().optional(),
      column: z.string().optional(),
    })
    .optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const SourceFileSchema = z.object({
  type: SourceTypeSchema,
  fileName: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  path: z.string().nullable(),
});
export type SourceFile = z.infer<typeof SourceFileSchema>;

export const SummarySchema = z.record(z.string(), z.number().nullable());
export type ReportSummary = z.infer<typeof SummarySchema>;

export const ReportManifestSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  type: ReportTypeSchema,
  kind: ReportKindSchema,
  period: PeriodSchema,
  periodKey: z.string(),
  title: z.string().nullable().default(null),
  status: ReportStatusSchema,
  source: SourceFileSchema.nullable(),
  dataPath: z.string().nullable(),
  insights: z.array(InsightSchema).default([]),
  warnings: z.array(ValidationIssueSchema).default([]),
  /** Indicadores-chave pré-calculados — alimentam histórico e comparações sem ler data.json. */
  summary: SummarySchema.default({}),
  /** Rótulos do funil no período (para a evolução exibir nomes corretos). */
  labels: z.record(z.string(), z.string()).default({}),
  allowDownload: z.boolean().default(false),
  importId: z.string().nullable().default(null),
  /** Enviado como dado retroativo (meses anteriores, para comparação). */
  retroactive: z.boolean().default(false),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  publishedAt: TimestampSchema.nullable().default(null),
  unpublishedAt: TimestampSchema.nullable().default(null),
  archivedAt: TimestampSchema.nullable().default(null),
  version: z.number().int().default(1),
});
export type ReportManifest = z.infer<typeof ReportManifestSchema>;

export const ReportIndexEntrySchema = ReportManifestSchema.pick({
  id: true,
  type: true,
  kind: true,
  period: true,
  periodKey: true,
  title: true,
  status: true,
  summary: true,
  labels: true,
  allowDownload: true,
  retroactive: true,
  updatedAt: true,
  publishedAt: true,
  createdAt: true,
}).extend({
  sourceType: SourceTypeSchema.nullable(),
  sourceFileName: z.string().nullable().default(null),
  insightCount: z.number().int().default(0),
});
export type ReportIndexEntry = z.infer<typeof ReportIndexEntrySchema>;

export const ImportIndexEntrySchema = z.object({
  id: z.string(),
  reportType: ReportTypeSchema,
  fileName: z.string(),
  format: z.string(),
  status: z.string(),
  periodKey: z.string().nullable(),
  errorCount: z.number().int().default(0),
  warningCount: z.number().int().default(0),
  reportIds: z.array(z.string()).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type ImportIndexEntry = z.infer<typeof ImportIndexEntrySchema>;

/** Índice por cliente: pequeno, reconstruível a partir dos manifests. */
export const ClientIndexSchema = z.object({
  clientId: z.string(),
  updatedAt: TimestampSchema,
  reports: z.array(ReportIndexEntrySchema).default([]),
  imports: z.array(ImportIndexEntrySchema).default([]),
});
export type ClientIndex = z.infer<typeof ClientIndexSchema>;

export const VISIBLE_TO_CLIENT: ReadonlySet<ReportStatus> = new Set(["published"]);
