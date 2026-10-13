import { normalizeText, slugify } from "@/lib/ids";

/** Qualificadores que não mudam a etapa ("Leads registrados" = "Leads", "Agendamentos válidos" = "Agendamentos"). */
const STAGE_QUALIFIERS = /\b(registrad[oa]s?|valid[oa]s?|confirmad[oa]s?|realizad[oa]s?|efetivad[oa]s?|efetiv[oa]s?|informad[oa]s?|do mes|no mes|no periodo)\b/g;

/** Chave da etapa do funil para comparar meses com rótulos um pouco diferentes. */
export function stageCanonical(label: string): string {
  return slugify(normalizeText(label).replace(STAGE_QUALIFIERS, " ").replace(/\s+/g, " ").trim()) || slugify(label);
}
