"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { formatPeriod, parsePeriodKey } from "@/lib/dates/period";
import { requireAdmin } from "@/features/auth/session";
import { InsightTypeSchema } from "./schema";
import { archiveReport, changeReportPeriod, newInsightId, publishReport, restoreReport, unpublishReport, updateReportDetails } from "./service";
import { repairClientIndex } from "@/features/admin/maintenance";
import { getRepositories } from "@/server/repositories";

function ids(clientId: string, reportId: string) {
  if (!isValidId(clientId, "cl") || !isValidId(reportId, "rp")) throw new Error("invalid id");
}

function refresh() {
  revalidatePath("/adm", "layout");
}

type Op = "publish" | "unpublish" | "archive" | "restore";

const MESSAGES: Record<Op, string> = {
  publish: "Relatório publicado. O cliente já pode ver.",
  unpublish: "Publicação retirada. O cliente não vê mais este relatório.",
  archive: "Relatório arquivado (continua no histórico interno).",
  restore: "Relatório voltou para rascunho.",
};

export async function reportStatusAction(clientId: string, reportId: string, op: Op): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    ids(clientId, reportId);
    const fn = { publish: publishReport, unpublish: unpublishReport, archive: archiveReport, restore: restoreReport }[op];
    await fn(clientId, reportId, session.email);
    refresh();
    return { ok: true, data: undefined, message: MESSAGES[op] };
  } catch (e) {
    return actionError(e, `report:${op}`);
  }
}

const InsightInput = z.object({
  id: z.string().optional(),
  type: InsightTypeSchema,
  title: z.string().trim().min(1, "Informe um título.").max(140),
  description: z.string().trim().max(1500).default(""),
});

const DetailsInput = z.object({
  title: z.string().trim().max(160).nullable(),
  allowDownload: z.boolean(),
  insights: z.array(InsightInput).max(12, "Use no máximo 12 insights."),
});

export async function saveReportDetailsAction(clientId: string, reportId: string, input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    ids(clientId, reportId);
    const parsed = DetailsInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const existing = await getRepositories().reports.getIndex(clientId);
    if (!existing.reports.some((r) => r.id === reportId)) return { ok: false, error: "Relatório não encontrado." };
    await updateReportDetails(
      clientId,
      reportId,
      {
        title: parsed.data.title || null,
        allowDownload: parsed.data.allowDownload,
        insights: parsed.data.insights.map((i) => ({ id: i.id && i.id.startsWith("in_") ? i.id : newInsightId(), type: i.type, title: i.title, description: i.description, source: "manual" as const })),
      },
      session.email,
    );
    refresh();
    return { ok: true, data: undefined, message: "Alterações salvas." };
  } catch (e) {
    return actionError(e, "report:details");
  }
}

export async function changeReportPeriodAction(clientId: string, reportId: string, key: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    ids(clientId, reportId);
    const period = typeof key === "string" && key.length <= 40 ? parsePeriodKey(key) : null;
    if (!period) return { ok: false, error: "Período inválido." };
    await changeReportPeriod(clientId, reportId, period, session.email);
    refresh();
    return { ok: true, data: undefined, message: `Período alterado para ${formatPeriod(period)}.` };
  } catch (e) {
    return actionError(e, "report:period");
  }
}

export async function rebuildIndexAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    if (!isValidId(clientId, "cl")) throw new Error("invalid id");
    const r = await repairClientIndex(clientId);
    refresh();
    return { ok: true, data: undefined, message: `Índice reconstruído: ${r.reports} relatório(s) e ${r.imports} upload(s) conferidos.` };
  } catch (e) {
    return actionError(e, "report:rebuild-index");
  }
}
