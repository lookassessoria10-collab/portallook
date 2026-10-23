import { normalizeText } from "@/lib/ids";
import { matchClientSheet } from "@/features/social/normalize";
import type { Client } from "@/features/clients/schema";
import { actionKindFromText, actionStatusFromText, splitActionTitle, type ClientAction } from "./schema";
import snapshot from "./sheet-snapshot.json";

/**
 * Snapshot da planilha de ações da Look (uma aba por cliente), gerado por
 * `npm run actions:snapshot -- planilha.xlsx`. É a base de cada cliente até a
 * primeira edição no painel; depois disso vale o `actions.json` do cliente.
 */
export interface SheetActionRow {
  id: string;
  row: number;
  action: string;
  type: string;
  suggestedAt: string | null;
  executedAt: string | null;
  status: string;
  notes: string;
  lastUpdateAt: string | null;
  progress: string;
}

export interface ActionsSheet {
  name: string;
  actions: SheetActionRow[];
}

export const ACTIONS_SNAPSHOT: { source: string; extractedAt: string; sheets: ActionsSheet[] } = snapshot;

export const ACTION_SHEET_NAMES: string[] = ACTIONS_SNAPSHOT.sheets.map((s) => s.name);

/**
 * Clientes cujo nome no portal não bate com o nome da aba (os slugs já são usados
 * pelos relatórios fiéis): "Dra. Isabor Sant'Anna" está na aba "Isabor Santana".
 */
const SHEET_BY_SLUG: Record<string, string> = {
  "dra-isabor-sant-anna": "Isabor Santana",
  "serenity-terapias": "Serenity",
};

/** Sem "Dra./Dr.", acentos, espaços e letras dobradas ("Sant'Anna" = "Santana"). */
const squash = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter((t) => t && !["dr", "dra", "drs", "dras"].includes(t))
    .join("")
    .replace(/(.)\1+/g, "$1");

/**
 * Aba da planilha que pertence ao cliente — ou null, quando nenhuma (ou mais de uma) corresponde.
 * Usa a mesma regra da planilha de rede social: nome, nome curto ou slug, sem acento, caixa e "Dra.".
 */
export function findActionsSheet(client: Pick<Client, "slug" | "name" | "shortName">, sheetNames: readonly string[] = ACTION_SHEET_NAMES): string | null {
  const alias = SHEET_BY_SLUG[client.slug];
  if (alias && sheetNames.includes(alias)) return alias;
  const match = matchClientSheet(sheetNames, [client.name, client.shortName, client.slug]);
  if (match.kind === "match") return match.names[0];
  if (match.kind === "ambiguous") return null;
  const targets = new Set([client.name, client.shortName, client.slug.replace(/-/g, " ")].map(squash).filter(Boolean));
  const hits = sheetNames.filter((name) => targets.has(squash(name)));
  return hits.length === 1 ? hits[0] : null;
}

export function getActionsSheet(name: string): ActionsSheet | null {
  return ACTIONS_SNAPSHOT.sheets.find((s) => s.name === name) ?? null;
}

/** Linha da planilha → ação do portal (status lido com as regras da planilha). */
export function actionFromSheetRow(row: SheetActionRow): ClientAction {
  const { title, category } = splitActionTitle(row.action);
  return {
    id: row.id,
    title,
    category,
    kind: actionKindFromText(row.type),
    status: actionStatusFromText(row.status),
    suggestedAt: row.suggestedAt,
    executedAt: row.executedAt,
    lastUpdateAt: row.lastUpdateAt,
    progress: row.progress,
    notes: row.notes,
    clientNote: "",
    visible: true,
  };
}
