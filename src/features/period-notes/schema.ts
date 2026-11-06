import { z } from "zod";
import { ReportTypeSchema, TimestampSchema, type ReportType } from "@/features/reports/schema";

/** Mês no formato AAAA-MM (a mesma chave de período dos relatórios mensais). */
export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "Sem dados": o mês não tem relatório. "Dados incompletos": o relatório existe, mas cobre só parte do mês. */
export const PeriodNoteStatusSchema = z.enum(["no_data", "partial"]);
export type PeriodNoteStatus = z.infer<typeof PeriodNoteStatusSchema>;

export const PERIOD_NOTE_STATUS_LABEL: Record<PeriodNoteStatus, string> = {
  no_data: "Sem dados",
  partial: "Dados incompletos",
};

export const PERIOD_NOTE_STATUS_TONE: Record<PeriodNoteStatus, "attention" | "info"> = { no_data: "attention", partial: "info" };

export const PERIOD_NOTE_TEXT_MAX = 600;

/**
 * Justificativa de um mês, por área (comercial, tráfego…): o cliente vê o texto no
 * portal, no mês correspondente. Fica no cadastro do cliente (client.json).
 */
export const PeriodNoteSchema = z.object({
  type: ReportTypeSchema,
  periodKey: z.string().regex(MONTH_KEY_PATTERN, "Mês inválido."),
  status: PeriodNoteStatusSchema,
  text: z.string().trim().min(1, "Escreva a justificativa.").max(PERIOD_NOTE_TEXT_MAX, `Use no máximo ${PERIOD_NOTE_TEXT_MAX} caracteres.`),
  updatedAt: TimestampSchema,
});
export type PeriodNote = z.infer<typeof PeriodNoteSchema>;

export interface PeriodNotePreset {
  id: string;
  status: PeriodNoteStatus;
  /** Áreas em que o texto faz sentido (sem lista = todas). */
  types?: readonly ReportType[];
  /** Nome curto na lista do ADM. */
  title: string;
  /** Texto que o cliente vê. */
  text: string;
}

/** Textos prontos oferecidos no ADM. Ao escolher um, ele vai para o campo e ainda pode ser editado. */
export const PERIOD_NOTE_PRESETS: readonly PeriodNotePreset[] = [
  { id: "late", status: "no_data", title: "Dados ainda não recebidos", text: "Os dados deste mês ainda não foram recebidos. O relatório será publicado aqui assim que estiverem disponíveis." },
  { id: "start", status: "no_data", title: "Trabalho começou depois", text: "O trabalho da Look começou depois deste mês, por isso ainda não há dados referentes a ele." },
  { id: "paused", status: "no_data", title: "Atividades pausadas", text: "As atividades ficaram pausadas neste mês, por isso não há resultados para apresentar." },
  { id: "campaigns-off", status: "no_data", types: ["traffic"], title: "Campanhas pausadas o mês todo", text: "As campanhas ficaram pausadas durante todo o mês, por isso não há resultados de tráfego pago." },
  { id: "account", status: "no_data", types: ["traffic"], title: "Conta de anúncios indisponível", text: "A conta de anúncios ficou indisponível neste mês (bloqueio ou revisão da plataforma), o que impediu a veiculação das campanhas." },
  { id: "no-posts", status: "no_data", types: ["social"], title: "Sem publicações no mês", text: "Não houve publicações no perfil neste mês, por isso não há dados de desempenho." },
  { id: "access", status: "no_data", types: ["traffic", "social"], title: "Sem acesso à plataforma", text: "Não foi possível acessar os dados da plataforma neste mês (instabilidade ou perda de acesso à conta)." },
  { id: "crm", status: "no_data", types: ["commercial"], title: "Dados comerciais não repassados", text: "Os dados comerciais deste mês (leads, agendamentos e vendas) não foram repassados à Look." },
  { id: "no-plan", status: "no_data", types: ["media_plan"], title: "Sem mídia paga no mês", text: "Não houve investimento em mídia paga planejado para este mês." },
  { id: "partial-late", status: "partial", title: "Parte dos dados não recebida", text: "Parte dos dados deste mês ainda não foi recebida. Os números serão atualizados assim que estiverem completos." },
  { id: "partial-start", status: "partial", title: "Começou no meio do mês", text: "O trabalho começou no meio do mês, então os números cobrem apenas parte do período." },
  { id: "partial-paused", status: "partial", types: ["traffic", "media_plan"], title: "Campanhas pausadas parte do mês", text: "As campanhas ficaram pausadas em parte do mês, o que reduziu os resultados do período." },
  { id: "partial-platform", status: "partial", types: ["traffic", "social"], title: "Instabilidade na plataforma", text: "A plataforma apresentou instabilidade e parte dos dados não pôde ser exportada. Os números podem estar abaixo do real." },
  { id: "partial-channels", status: "partial", types: ["traffic", "commercial"], title: "Canais não incluídos", text: "Alguns canais ou plataformas não estão incluídos nos números deste mês." },
  { id: "partial-crm", status: "partial", types: ["commercial"], title: "Registros comerciais incompletos", text: "Parte dos registros comerciais do mês (leads, agendamentos ou vendas) não foi informada, por isso alguns indicadores podem estar incompletos." },
  { id: "partial-metrics", status: "partial", types: ["social"], title: "Métricas não disponibilizadas", text: "Algumas métricas (como alcance ou visualizações de stories) não foram disponibilizadas pela plataforma neste mês." },
];

export function notePresetsFor(type: ReportType, status: PeriodNoteStatus): PeriodNotePreset[] {
  return PERIOD_NOTE_PRESETS.filter((p) => p.status === status && (!p.types || p.types.includes(type)));
}

/** Ordem de exibição: mais recentes primeiro. */
export function sortPeriodNotes<T extends Pick<PeriodNote, "periodKey" | "type">>(notes: readonly T[]): T[] {
  return [...notes].sort((a, b) => (a.periodKey === b.periodKey ? a.type.localeCompare(b.type) : a.periodKey < b.periodKey ? 1 : -1));
}
