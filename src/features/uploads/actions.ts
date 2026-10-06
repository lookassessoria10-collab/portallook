"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { parsePeriodKey } from "@/lib/dates/period";
import { requireAdmin } from "@/features/auth/session";
import { ReportTypeSchema } from "@/features/reports/schema";
import { CsvContentSchema, ImportModeSchema, UploadPlatformSchema, type ImportRecord } from "./schema";
import { confirmImport, deleteImport, discardImport, initImport, processImport, publishImportDrafts, type InitImportResult } from "./service";

const InitSchema = z.object({
  clientId: z.string().refine((v) => isValidId(v, "cl"), "Selecione o cliente."),
  reportType: ReportTypeSchema,
  fileName: z.string().min(1).max(260),
  size: z.number().int().positive(),
  contentType: z.string().max(200),
  csvContent: CsvContentSchema.nullable().optional(),
  csvDimensionLabel: z.string().max(60).nullable().optional(),
  platform: UploadPlatformSchema.nullable().optional(),
  mode: ImportModeSchema.optional(),
  periodKey: z.string().max(40).nullable().optional(),
  title: z.string().max(160).nullable().optional(),
  allowDownload: z.boolean().optional(),
});

export async function initImportAction(input: unknown): Promise<ActionResult<InitImportResult>> {
  await requireAdmin();
  try {
    const parsed = InitSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados do upload inválidos." };
    const { periodKey, ...rest } = parsed.data;
    const period = periodKey ? parsePeriodKey(periodKey) : null;
    if (periodKey && !period) return { ok: false, error: "Período inválido." };
    return { ok: true, data: await initImport({ ...rest, period }) };
  } catch (e) {
    return actionError(e, "upload:init");
  }
}

export async function processImportAction(importId: string): Promise<ActionResult<ImportRecord>> {
  await requireAdmin();
  try {
    if (!isValidId(importId, "im")) return { ok: false, error: "Importação inválida." };
    const record = await processImport(importId);
    revalidatePath("/adm", "layout");
    return { ok: true, data: record };
  } catch (e) {
    return actionError(e, "upload:process");
  }
}

export async function confirmImportAction(importId: string, periodKeys: string[], options: { useRequestedPeriod?: boolean } = {}): Promise<ActionResult<ImportRecord>> {
  await requireAdmin();
  try {
    if (!isValidId(importId, "im")) return { ok: false, error: "Importação inválida." };
    const keys = z.array(z.string().max(40)).max(60).parse(periodKeys);
    const record = await confirmImport(importId, { periodKeys: keys, useRequestedPeriod: options?.useRequestedPeriod === true });
    revalidatePath("/adm", "layout");
    return { ok: true, data: record, message: record.reportIds.length === 1 ? "Rascunho criado." : `${record.reportIds.length} rascunhos criados.` };
  } catch (e) {
    return actionError(e, "upload:confirm");
  }
}

export async function publishImportAction(importId: string): Promise<ActionResult<{ published: number }>> {
  const session = await requireAdmin();
  try {
    if (!isValidId(importId, "im")) return { ok: false, error: "Importação inválida." };
    const published = await publishImportDrafts(importId, session.email);
    revalidatePath("/adm", "layout");
    const message = published === 0 ? "Nenhum rascunho pendente: os relatórios já tinham sido publicados ou arquivados." : published === 1 ? "1 relatório publicado. O cliente já pode ver." : `${published} relatórios publicados. O cliente já pode ver.`;
    return { ok: true, data: { published }, message };
  } catch (e) {
    return actionError(e, "upload:publish");
  }
}

export async function discardImportAction(importId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    if (!isValidId(importId, "im")) return { ok: false, error: "Importação inválida." };
    await discardImport(importId);
    revalidatePath("/adm", "layout");
    return { ok: true, data: undefined, message: "Upload descartado." };
  } catch (e) {
    return actionError(e, "upload:discard");
  }
}

export async function deleteImportAction(clientId: string, importId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    if (!isValidId(clientId, "cl") || !isValidId(importId, "im")) return { ok: false, error: "Importação inválida." };
    await deleteImport(clientId, importId, session.email);
    revalidatePath("/adm", "layout");
    return { ok: true, data: undefined, message: "Upload excluído." };
  } catch (e) {
    return actionError(e, "upload:delete");
  }
}
