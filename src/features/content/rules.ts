import { normalizeText } from "@/lib/ids";
import { matchClientSheet } from "@/features/social/normalize";
import type { Client } from "@/features/clients/schema";
import type { ClickUpListRef, ContentItem, ContentRules, ContentStatus } from "./schema";

/**
 * Status do ClickUp → situação para o cliente. Cada lista tem os seus status; a leitura é
 * pelo nome (sem acento e emoji): postado/fechado → Publicado; aguardando/pendente → Aguarda
 * sua aprovação; aprovado → Aprovado; revisão/correção/feito → Em produção; o resto → Em planejamento.
 */
export function contentStatus(item: Pick<ContentItem, "statusName" | "statusType" | "progress">): ContentStatus {
  const s = normalizeText(item.statusName);
  if (item.statusType === "closed" || /postad|publicad/.test(s) || item.progress.some((p) => /postad|publicad/.test(normalizeText(p)))) return "published";
  if (/aguard|pendente/.test(s)) return "awaiting";
  if (/^aprovad/.test(s)) return "approved";
  if (/revis|corre|feito|produc|edica|ajuste/.test(s)) return "production";
  return "planning";
}

export type HiddenReason = "internal" | "placeholder" | "to_confirm" | "type" | "untyped";

export const HIDDEN_REASON_LABEL: Record<HiddenReason, string> = {
  internal: "etiqueta interno",
  placeholder: "tema ainda sem conteúdo",
  to_confirm: "a confirmar",
  type: "tipo fora do portal",
  untyped: "sem tipo, formato e legenda",
};

/** Por que o item não vai para o portal (null = vai). */
export function hiddenReason(item: ContentItem, rules: ContentRules): HiddenReason | null {
  if (rules.hideInternalTag && item.tags.some((t) => normalizeText(t) === "interno")) return "internal";
  if (rules.hidePlaceholders && /^tema( \d+)?$/.test(normalizeText(item.name)) && !item.caption) return "placeholder";
  if (rules.hideToConfirm && /\(\s*a? ?confirmar/i.test(item.name)) return "to_confirm";
  if (item.type) return rules.types.includes(normalizeText(item.type)) ? null : "type";
  return item.format || item.caption ? null : "untyped";
}

export interface ClassifiedContent {
  visible: ContentItem[];
  hidden: Array<{ item: ContentItem; reason: HiddenReason }>;
}

export function applyContentRules(items: readonly ContentItem[], rules: ContentRules): ClassifiedContent {
  const visible: ContentItem[] = [];
  const hidden: ClassifiedContent["hidden"] = [];
  for (const item of items) {
    const reason = hiddenReason(item, rules);
    if (reason) hidden.push({ item, reason });
    else visible.push(item);
  }
  return { visible, hidden };
}

/** O que vale corrigir no ClickUp antes que o cliente veja (só para o painel). */
export function contentWarnings(visible: readonly ContentItem[], today: string) {
  return {
    pastNotPublished: visible.filter((i) => i.date < today && ["planning", "production"].includes(contentStatus(i))),
    awaiting: visible.filter((i) => contentStatus(i) === "awaiting"),
    noFormat: visible.filter((i) => !i.format),
  };
}

/** Sem "Dra./Dr.", acentos, espaços e letras dobradas ("Sant'Anna" = "Santana"). */
const squash = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter((t) => t && !["dr", "dra", "drs", "dras"].includes(t))
    .join("")
    .replace(/(.)\1+/g, "$1");

/**
 * Lista do ClickUp do cliente, pelo nome — a mesma regra da planilha de rede social (nome,
 * nome curto ou slug, sem acento, caixa e "Dra."). Com duas listas do mesmo nome, vale a
 * que não está numa pasta de clientes antigos; sem uma única candidata, null.
 */
export function findClickUpList(client: Pick<Client, "name" | "shortName" | "slug">, lists: readonly ClickUpListRef[]): ClickUpListRef | null {
  const names = [...new Set(lists.map((l) => l.name))];
  const match = matchClientSheet(names, [client.name, client.shortName, client.slug]);
  let candidates: ClickUpListRef[] = [];
  if (match.kind === "match") candidates = lists.filter((l) => match.names.includes(l.name));
  else if (match.kind === "none") {
    const targets = new Set([client.name, client.shortName, client.slug.replace(/-/g, " ")].map(squash).filter(Boolean));
    candidates = lists.filter((l) => targets.has(squash(l.name)));
  }
  if (candidates.length > 1) {
    const current = candidates.filter((l) => !/antig|arquiv|inativ/.test(normalizeText(l.folder ?? "")));
    if (current.length) candidates = current;
  }
  return candidates.length === 1 ? candidates[0] : null;
}
