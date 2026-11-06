import "server-only";
import { UserFacingError } from "@/lib/errors";
import { formatPeriod, parsePeriodKey } from "@/lib/dates/period";
import { logEvent } from "@/features/events/service";
import { REPORT_TYPE_LABEL, type ReportType } from "@/features/reports/schema";
import { getRepositories } from "@/server/repositories";
import { PeriodNoteSchema, sortPeriodNotes, type PeriodNote, type PeriodNoteStatus } from "./schema";

export interface PeriodNoteInput {
  type: ReportType;
  periodKey: string;
  status: PeriodNoteStatus;
  text: string;
  /** Edição que trocou o mês: a justificativa do mês anterior sai. */
  replaceKey?: string | null;
}

const monthLabel = (key: string) => {
  const p = parsePeriodKey(key);
  return p ? formatPeriod(p) : key;
};

/** Cria ou substitui a justificativa do mês (uma por área e mês). */
export async function savePeriodNote(clientId: string, input: PeriodNoteInput, actor: string | null): Promise<PeriodNote> {
  const note = PeriodNoteSchema.parse({ type: input.type, periodKey: input.periodKey, status: input.status, text: input.text, updatedAt: new Date().toISOString() });
  await getRepositories().clients.update(clientId, (c) => {
    if (!c.modules[note.type].enabled) throw new UserFacingError(`O módulo ${REPORT_TYPE_LABEL[note.type]} não está ativo para este cliente.`);
    const kept = c.periodNotes.filter((n) => n.type !== note.type || (n.periodKey !== note.periodKey && n.periodKey !== input.replaceKey));
    return { ...c, periodNotes: sortPeriodNotes([...kept, note]) };
  });
  await logEvent("client.updated", {
    clientId,
    actor,
    summary: `Justificativa de ${monthLabel(note.periodKey).toLowerCase()} (${REPORT_TYPE_LABEL[note.type]}) salva.`,
    meta: { type: note.type, period: note.periodKey, status: note.status },
  });
  return note;
}

export async function deletePeriodNote(clientId: string, type: ReportType, periodKey: string, actor: string | null): Promise<void> {
  let removed = false;
  await getRepositories().clients.update(clientId, (c) => {
    const kept = c.periodNotes.filter((n) => n.type !== type || n.periodKey !== periodKey);
    removed = kept.length !== c.periodNotes.length;
    return { ...c, periodNotes: kept };
  });
  if (!removed) throw new UserFacingError("Justificativa não encontrada. Recarregue a página.");
  await logEvent("client.updated", {
    clientId,
    actor,
    summary: `Justificativa de ${monthLabel(periodKey).toLowerCase()} (${REPORT_TYPE_LABEL[type]}) removida.`,
    meta: { type, period: periodKey },
  });
}
