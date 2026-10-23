import "server-only";
import { cache } from "react";
import { createId } from "@/lib/ids";
import { NotFoundError, UserFacingError } from "@/lib/errors";
import { logEvent } from "@/features/events/service";
import { listClients, requireClient } from "@/features/clients/service";
import type { Client } from "@/features/clients/schema";
import { getRepositories } from "@/server/repositories";
import { ActionInputSchema, ClientActionSchema, MAX_ACTIONS, type ActionInput, type ClientAction, type ClientActions } from "./schema";
import { ACTIONS_SNAPSHOT, actionFromSheetRow, findActionsSheet, getActionsSheet } from "./sheet";
import { buildPortalActions, type PortalActionsVM } from "./view-model";

/**
 * De onde vêm as ações do cliente:
 * - "stored": `actions.json`, gravado na 1ª edição pelo painel (vale ele, não a planilha);
 * - "sheet": a aba correspondente da planilha de ações (snapshot no código);
 * - "none": nenhuma aba corresponde — o cliente não tem ações até alguém cadastrar.
 */
export type ActionsOrigin = "stored" | "sheet" | "none";

export interface ResolvedActions {
  clientId: string;
  enabled: boolean;
  items: ClientAction[];
  origin: ActionsOrigin;
  /** Aba da planilha (automática, ou a usada na importação). */
  sheet: string | null;
  extractedAt: string | null;
  updatedAt: string | null;
}

/** Ações do cliente na planilha (null = nenhuma aba corresponde). */
function documentFromSheet(client: Client): ClientActions | null {
  const name = findActionsSheet(client);
  const sheet = name ? getActionsSheet(name) : null;
  if (!sheet) return null;
  return {
    clientId: client.id,
    enabled: true,
    source: { sheet: sheet.name, extractedAt: ACTIONS_SNAPSHOT.extractedAt },
    items: sheet.actions.map(actionFromSheetRow),
    updatedAt: new Date().toISOString(),
    version: 0,
  };
}

export const getClientActions = cache(async (client: Client): Promise<ResolvedActions> => {
  const stored = await getRepositories().actions.get(client.id);
  if (stored) {
    return { clientId: client.id, enabled: stored.enabled, items: stored.items, origin: "stored", sheet: stored.source?.sheet ?? null, extractedAt: stored.source?.extractedAt ?? null, updatedAt: stored.updatedAt };
  }
  const fromSheet = documentFromSheet(client);
  if (fromSheet) return { clientId: client.id, enabled: true, items: fromSheet.items, origin: "sheet", sheet: fromSheet.source?.sheet ?? null, extractedAt: ACTIONS_SNAPSHOT.extractedAt, updatedAt: null };
  return { clientId: client.id, enabled: true, items: [], origin: "none", sheet: null, extractedAt: null, updatedAt: null };
});

/** O que o cliente vê na área "Ações" (null = área escondida). */
export async function loadPortalActions(client: Client): Promise<PortalActionsVM | null> {
  const actions = await getClientActions(client);
  if (!actions.enabled) return null;
  return buildPortalActions(actions.items, actions.updatedAt);
}

/**
 * Toda alteração parte do documento gravado — ou, na 1ª edição, das ações da planilha,
 * que passam a ser mantidas pelo painel. Nenhum outro dado do cliente é tocado.
 */
async function mutateActions(clientId: string, actor: string | null, summary: string, mutate: (doc: ClientActions) => ClientActions): Promise<ClientActions> {
  const client = await requireClient(clientId);
  const next = await getRepositories().actions.update(clientId, (current) =>
    mutate(current ?? documentFromSheet(client) ?? { clientId, enabled: true, source: null, items: [], updatedAt: new Date().toISOString(), version: 0 }),
  );
  await logEvent("actions.updated", { clientId, actor, summary });
  return next;
}

export async function saveAction(clientId: string, input: ActionInput, actor: string | null): Promise<ClientAction> {
  const { id, ...fields } = ActionInputSchema.parse(input);
  const action = ClientActionSchema.parse({ ...fields, id: id ?? createId("ac") });
  const doc = await mutateActions(clientId, actor, id ? `Ação "${action.title}" atualizada.` : `Ação "${action.title}" adicionada.`, (current) => {
    if (id) {
      if (!current.items.some((a) => a.id === id)) throw new NotFoundError("Esta ação não existe mais. Recarregue a página.");
      return { ...current, items: current.items.map((a) => (a.id === id ? action : a)) };
    }
    if (current.items.length >= MAX_ACTIONS) throw new UserFacingError(`O limite é de ${MAX_ACTIONS} ações por cliente.`);
    return { ...current, items: [...current.items, action] };
  });
  return doc.items.find((a) => a.id === action.id) ?? action;
}

export async function deleteAction(clientId: string, actionId: string, actor: string | null): Promise<void> {
  const current = (await getClientActions(await requireClient(clientId))).items.find((a) => a.id === actionId);
  await mutateActions(clientId, actor, `Ação "${current?.title ?? actionId}" removida.`, (doc) => {
    if (!doc.items.some((a) => a.id === actionId)) throw new NotFoundError("Esta ação não existe mais. Recarregue a página.");
    return { ...doc, items: doc.items.filter((a) => a.id !== actionId) };
  });
}

export async function setActionVisible(clientId: string, actionId: string, visible: boolean, actor: string | null): Promise<void> {
  await mutateActions(clientId, actor, visible ? "Ação exibida no portal." : "Ação escondida do portal.", (doc) => {
    if (!doc.items.some((a) => a.id === actionId)) throw new NotFoundError("Esta ação não existe mais. Recarregue a página.");
    return { ...doc, items: doc.items.map((a) => (a.id === actionId ? { ...a, visible } : a)) };
  });
}

export async function setActionsEnabled(clientId: string, enabled: boolean, actor: string | null): Promise<void> {
  await mutateActions(clientId, actor, enabled ? "Área de ações exibida no portal." : "Área de ações escondida do portal.", (doc) => ({ ...doc, enabled }));
}

/** Substitui as ações do cliente pelas da aba escolhida da planilha. */
export async function importActionsFromSheet(clientId: string, sheetName: string, actor: string | null): Promise<number> {
  const sheet = getActionsSheet(sheetName);
  if (!sheet) throw new UserFacingError("Aba não encontrada na planilha de ações.");
  const doc = await mutateActions(clientId, actor, `Ações importadas da aba "${sheet.name}" da planilha.`, (current) => ({
    ...current,
    source: { sheet: sheet.name, extractedAt: ACTIONS_SNAPSHOT.extractedAt },
    items: sheet.actions.map(actionFromSheetRow),
  }));
  return doc.items.length;
}

export interface ActionsOverviewRow {
  client: Client;
  actions: ResolvedActions;
}

/** Ações de todos os clientes (menos os arquivados) e as abas da planilha que não são de nenhum deles. */
export async function listActionsOverview(): Promise<{ rows: ActionsOverviewRow[]; unmatchedSheets: string[] }> {
  const clients = (await listClients()).filter((c) => c.status !== "archived");
  const rows = await Promise.all(clients.map(async (client) => ({ client, actions: await getClientActions(client) })));
  const used = new Set(rows.map((r) => r.actions.sheet).filter(Boolean));
  return { rows, unmatchedSheets: ACTIONS_SNAPSHOT.sheets.map((s) => s.name).filter((n) => !used.has(n)) };
}
