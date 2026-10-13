import { normalizeText } from "@/lib/ids";
import type { CommercialLayout } from "@/features/clients/schema";
import type { SectionNote } from "./schema";

/**
 * Onde cada nota da aba Notas aparece, por modelo de painel: a coluna Seção da planilha é
 * comparada (sem acento nem maiúsculas) com estes nomes. Nota sem lugar no modelo do
 * cliente vai para "Notas da Look", no fim de Insights/Diagnóstico — nunca se perde.
 */
export const NOTE_SLOTS: Record<CommercialLayout, Record<string, string[]>> = {
  detalhamentos: {
    foco: ["mes em foco", "foco", "destaque do mes", "resumo", "visao geral"],
    acumulado: ["acumulado", "acumulado do ano"],
    evolucao: ["evolucao", "evolucao mensal", "graficos"],
    detalhamento: ["detalhamento mensal", "mes a mes", "tabela mensal"],
    canais: ["canais", "desempenho por canal", "receita por canal", "leads por canal"],
    roi: ["roi", "retorno", "roi acumulado", "roi por canal"],
    comparativo: ["comparativo"],
    oportunidades: ["oportunidades", "agendamentos", "agenda"],
    plano: ["plano de acao", "prioridades", "proximos passos"],
  },
  funil: {
    acumulado: ["acumulado", "acumulado do ano", "indicadores consolidados"],
    funil: ["funil", "funil do mes", "funil de conversao"],
    taxas: ["taxas", "taxas de conversao", "conversao"],
    investimento: ["investimento", "investimento em midia", "midia", "midia paga"],
    receita: ["receita por canal", "receita", "canais"],
    leads: ["leads por canal", "leads", "leitura estrategica", "distribuicao de leads"],
    comparativo: ["comparativo", "comparativo mensal"],
    roi: ["roi", "retorno", "roi acumulado", "roi geral"],
    canais: ["canal a canal", "canais pagos", "performance por canal", "roi por canal"],
    oportunidades: ["oportunidades", "agendamentos", "agenda"],
    crescimento: ["crescimento", "oportunidade de crescimento", "potencial"],
    plano: ["plano de acao", "prioridades", "proximos passos"],
  },
};

const matches = (note: SectionNote, aliases: readonly string[]) => aliases.includes(normalizeText(note.section));

/** Textos das notas de um lugar do painel (`extra`: nomes de detalhamentos, ex.: "Terapeutas"). */
export function notesFor(notes: readonly SectionNote[], layout: CommercialLayout, slot: string): string[] {
  const aliases = NOTE_SLOTS[layout][slot] ?? [normalizeText(slot)];
  return notes.filter((n) => matches(n, aliases)).map((n) => n.text);
}

/** Notas que não têm lugar no modelo do cliente (nem num detalhamento com o mesmo nome). */
export function unplacedNotes(notes: readonly SectionNote[], layout: CommercialLayout, extra: readonly string[] = []): SectionNote[] {
  const all = [...Object.values(NOTE_SLOTS[layout]).flat(), ...extra.map(normalizeText)];
  return notes.filter((n) => !matches(n, all));
}
