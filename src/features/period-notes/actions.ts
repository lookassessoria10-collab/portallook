"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { requireAdmin } from "@/features/auth/session";
import { ReportTypeSchema } from "@/features/reports/schema";
import { MONTH_KEY_PATTERN, PERIOD_NOTE_TEXT_MAX, PeriodNoteStatusSchema } from "./schema";
import { deletePeriodNote, savePeriodNote } from "./service";

const NoteInput = z.object({
  type: ReportTypeSchema,
  periodKey: z.string().regex(MONTH_KEY_PATTERN, "Escolha o mês."),
  status: PeriodNoteStatusSchema,
  text: z.string().trim().min(1, "Escreva a justificativa.").max(PERIOD_NOTE_TEXT_MAX, `Use no máximo ${PERIOD_NOTE_TEXT_MAX} caracteres.`),
  replaceKey: z.string().regex(MONTH_KEY_PATTERN).nullable().optional(),
});

function refresh() {
  revalidatePath("/adm", "layout");
}

export async function savePeriodNoteAction(clientId: string, input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    if (!isValidId(clientId, "cl")) throw new Error("invalid id");
    const parsed = NoteInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    await savePeriodNote(clientId, parsed.data, session.email);
    refresh();
    return { ok: true, data: undefined, message: "Justificativa salva. O cliente já vê o texto no portal." };
  } catch (e) {
    return actionError(e, "period-note:save");
  }
}

export async function deletePeriodNoteAction(clientId: string, type: string, periodKey: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    if (!isValidId(clientId, "cl")) throw new Error("invalid id");
    const t = ReportTypeSchema.parse(type);
    if (typeof periodKey !== "string" || !MONTH_KEY_PATTERN.test(periodKey)) return { ok: false, error: "Mês inválido." };
    await deletePeriodNote(clientId, t, periodKey, session.email);
    refresh();
    return { ok: true, data: undefined, message: "Justificativa removida." };
  } catch (e) {
    return actionError(e, "period-note:delete");
  }
}
