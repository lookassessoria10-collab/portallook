import { z } from "zod";
import { InsightTypeSchema, PeriodSchema, ReportTypeSchema } from "@/features/reports/schema";

/**
 * Resultado intermediário da importação (imports/{id}/parsed.json): dados já
 * normalizados por período, prontos para virar rascunho(s) na confirmação.
 */
export const ParsedInsightSchema = z.object({
  type: InsightTypeSchema,
  title: z.string(),
  description: z.string().default(""),
});
export type ParsedInsight = z.infer<typeof ParsedInsightSchema>;

export const CommercialSectionSchema = z.enum(["funnel", "financial", "channels", "dimensions", "extraMetrics", "context"]);
export type CommercialSection = z.infer<typeof CommercialSectionSchema>;

export const ParsedPeriodSchema = z.object({
  periodKey: z.string(),
  period: PeriodSchema,
  /** Seções presentes no arquivo — CSVs parciais atualizam só a seção enviada. */
  sections: z.array(z.string()).default([]),
  data: z.unknown(),
  insights: z.array(ParsedInsightSchema).default([]),
});
export type ParsedPeriod = z.infer<typeof ParsedPeriodSchema>;

export const ParsedImportSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dataset"),
    reportType: ReportTypeSchema,
    sourceType: z.enum(["xlsx", "xls", "csv", "html_structured"]),
    partial: z.boolean().default(false),
    periods: z.array(ParsedPeriodSchema),
  }),
  z.object({
    kind: z.literal("document"),
    reportType: ReportTypeSchema,
    sourceType: z.enum(["pdf", "html_legacy"]),
    period: PeriodSchema,
    title: z.string().nullable(),
    pages: z.number().int().nullable(),
  }),
]);
export type ParsedImport = z.infer<typeof ParsedImportSchema>;
