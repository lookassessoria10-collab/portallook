"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { parsePeriodKey } from "@/lib/dates/period";
import { requireAdmin } from "@/features/auth/session";
import { CsvContentSchema, type ImportRecord } from "./schema";
import { confirmImport, discardImport, initImport, processImport, type InitImportResult } from "./service";

const InitSchema = z.object({
  clientId: z.string().refine((v) => isValidId(v, "cl"), "Selecione o cliente."),
  reportType: z.enum(["commercial", "traffic"]),
  fileName: z.string().min(1).max(260),
  size: z.number().int().positive(),
  contentType: z.string().max(200),
  csvContent: CsvContentSchema.nullable().optional(),
  csvDimensionLabel: z.string().max(60).nullable().optional(),
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

export async function confirmImportAction(importId: string, periodKeys: string[]): Promise<ActionResult<ImportRecord>> {
  await requireAdmin();
  try {
    if (!isValidId(importId, "im")) return { ok: false, error: "Importação inválida." };
    const keys = z.array(z.string().max(40)).max(60).parse(periodKeys);
    const record = await confirmImport(importId, { periodKeys: keys });
    revalidatePath("/adm", "layout");
    return { ok: true, data: record, message: record.reportIds.length === 1 ? "Rascunho criado." : `${record.reportIds.length} rascunhos criados.` };
  } catch (e) {
    return actionError(e, "upload:confirm");
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
