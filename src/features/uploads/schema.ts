import { z } from "zod";
import { PeriodSchema, ReportTypeSchema, TimestampSchema, ValidationIssueSchema, type ReportType } from "@/features/reports/schema";

/** "md": dados colados no painel (tabelas Markdown ou células copiadas da planilha). */
export const FileFormatSchema = z.enum(["xlsx", "xls", "csv", "pdf", "html", "md"]);
export type FileFormat = z.infer<typeof FileFormatSchema>;

/** CSV não tem abas: o ADM informa qual conteúdo o arquivo representa. */
export const CsvContentSchema = z.enum(["funnel", "financial", "channels", "traffic", "insights", "dimension", "media_plan"]);
export type CsvContent = z.infer<typeof CsvContentSchema>;

export const CSV_CONTENT_OPTIONS: Array<{ value: CsvContent; label: string; reportType: ReportType }> = [
  { value: "funnel", label: "Funil comercial", reportType: "commercial" },
  { value: "financial", label: "Financeiro", reportType: "commercial" },
  { value: "channels", label: "Canais", reportType: "commercial" },
  { value: "dimension", label: "Dimensão adicional (serviços, profissionais, unidades, produtos…)", reportType: "commercial" },
  { value: "insights", label: "Insights", reportType: "commercial" },
  { value: "traffic", label: "Tráfego (campanhas)", reportType: "traffic" },
  { value: "media_plan", label: "Plano de mídia (linhas do plano)", reportType: "media_plan" },
];

/**
 * "regular": o relatório do período (fluxo normal). "retroactive": meses anteriores
 * enviados de uma vez para comparação — sempre mensais, e os meses que já estão no
 * portal só são trocados se o ADM marcar.
 */
export const ImportModeSchema = z.enum(["regular", "retroactive"]);
export type ImportMode = z.infer<typeof ImportModeSchema>;

/**
 * Upload de uma plataforma só (ex.: exportação do Meta Ads com todos os meses):
 * cada período substitui apenas as campanhas dessa plataforma no relatório do mês.
 */
export const UploadPlatformSchema = z.enum(["meta_ads", "google_ads"]);
export type UploadPlatform = z.infer<typeof UploadPlatformSchema>;

export const UPLOAD_PLATFORM_OPTIONS: Array<{ value: UploadPlatform; label: string }> = [
  { value: "meta_ads", label: "Meta Ads (Facebook e Instagram)" },
  { value: "google_ads", label: "Google Ads" },
];

export const ImportStatusSchema = z.enum([
  "awaiting_file", // registro criado, arquivo ainda não enviado
  "uploaded", // arquivo recebido, aguardando validação
  "validated", // pronto para confirmar (pode ter avisos)
  "invalid", // erros impedem a importação
  "imported", // rascunho(s) criado(s)
  "discarded", // cancelado pelo ADM
  "failed", // falha técnica inesperada
]);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const IMPORT_STATUS_LABEL: Record<ImportStatus, string> = {
  awaiting_file: "Aguardando arquivo",
  uploaded: "Recebido",
  validated: "Validado",
  invalid: "Com erro",
  imported: "Importado",
  discarded: "Descartado",
  failed: "Falhou",
};

export const PreviewMetricSchema = z.object({ label: z.string(), value: z.string() });

export const PreviewPeriodSchema = z.object({
  periodKey: z.string(),
  period: PeriodSchema,
  label: z.string(),
  existing: z.enum(["none", "draft", "published", "other"]),
  metrics: z.array(PreviewMetricSchema),
  details: z.array(z.string()),
});
export type PreviewPeriod = z.infer<typeof PreviewPeriodSchema>;

export const ImportPreviewSchema = z.object({
  kind: z.enum(["dataset", "document"]),
  sourceType: z.string(),
  sheets: z.array(z.object({ name: z.string(), rows: z.number().int(), recognizedAs: z.string().nullable() })).default([]),
  periods: z.array(PreviewPeriodSchema).default([]),
  /** Período sugerido para importar (o pedido ou o mais recente do arquivo). */
  suggestedPeriodKeys: z.array(z.string()).default([]),
  documentPages: z.number().int().nullable().default(null),
  /**
   * O período escolhido no assistente não aparece no arquivo (que tem um único
   * período): o ADM decide na prévia se usa o escolhido ou o das datas do arquivo.
   */
  periodMismatch: z
    .object({ requestedKey: z.string(), requestedLabel: z.string(), existing: PreviewPeriodSchema.shape.existing })
    .nullable()
    .default(null),
});
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;

export const ImportRecordSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  reportType: ReportTypeSchema,
  format: FileFormatSchema,
  fileName: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  stagingPath: z.string(),
  status: ImportStatusSchema,
  csvContent: CsvContentSchema.nullable().default(null),
  csvDimensionLabel: z.string().nullable().default(null),
  /** Tráfego: arquivo de uma plataforma só (null = coluna Plataforma do arquivo). */
  platform: UploadPlatformSchema.nullable().default(null),
  mode: ImportModeSchema.default("regular"),
  requestedPeriod: PeriodSchema.nullable().default(null),
  title: z.string().nullable().default(null),
  allowDownload: z.boolean().default(false),
  issues: z.array(ValidationIssueSchema).default([]),
  preview: ImportPreviewSchema.nullable().default(null),
  parsedPath: z.string().nullable().default(null),
  reportIds: z.array(z.string()).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable().default(null),
});
export type ImportRecord = z.infer<typeof ImportRecordSchema>;
