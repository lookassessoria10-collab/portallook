import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { env } from "@/lib/env";
import { addDays, todayISO } from "@/lib/dates/period";
import { logError, UserFacingError } from "@/lib/errors";
import { logEvent } from "@/features/events/service";
import { requireClient } from "@/features/clients/service";
import type { Client } from "@/features/clients/schema";
import { getRepositories } from "@/server/repositories";
import { clickupConfigured, fetchList, fetchListTasks, fetchWorkspaceLists } from "./clickup";
import { normalizeTask, typeOptionsFrom } from "./normalize";
import { findClickUpList } from "./rules";
import { buildPortalContent, type PortalContentVM } from "./view-model";
import { ContentSettingsInputSchema, DEFAULT_CONTENT_RULES, type ClickUpListRef, type ContentCache, type ContentItem, type ContentRules, type ContentSettings, type ContentSettingsInput } from "./schema";

/** O portal relê a lista do ClickUp a cada 10 minutos (no máximo). */
export const CONTENT_TTL_MS = 10 * 60_000;
/** O catálogo de listas do workspace muda pouco: 6 horas. */
const LISTS_TTL_MS = 6 * 60 * 60_000;
/** Depois de uma falha, espera 2 minutos antes de tentar de novo (o ClickUp pode estar fora). */
const RETRY_AFTER_ERROR_MS = 2 * 60_000;
const DAY_MS = 86_400_000;

export { clickupConfigured };

const defaultSettings = (clientId: string): ContentSettings => ({ clientId, enabled: true, listId: null, rules: DEFAULT_CONTENT_RULES, updatedAt: new Date(0).toISOString(), version: 0 });

export const getContentSettings = cache(async (clientId: string): Promise<ContentSettings> => (await getRepositories().content.getSettings(clientId)) ?? defaultSettings(clientId));

function errorMessage(e: unknown): string {
  return e instanceof UserFacingError ? e.message : "Não foi possível ler o ClickUp agora.";
}

/** Depois da resposta, quando há uma requisição (`after` do Next); fora dela, em segundo plano. */
function inBackground(task: () => Promise<unknown>) {
  const run = () => task().catch((e) => logError("content:background", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Listas do workspace do ClickUp (guardadas por 6 horas). */
export async function getClickUpLists(options: { force?: boolean } = {}): Promise<{ lists: ClickUpListRef[]; teamId: string | null; fetchedAt: string | null; error: string | null }> {
  const repo = getRepositories().content;
  const cached = await repo.getLists();
  const refresh = async () => {
    const { teamId, lists } = await fetchWorkspaceLists();
    const next = { fetchedAt: new Date().toISOString(), teamId, lists };
    await repo.saveLists(next);
    return next;
  };
  if (cached && !options.force) {
    if (Date.now() - Date.parse(cached.fetchedAt) >= LISTS_TTL_MS) inBackground(refresh);
    return { lists: cached.lists, teamId: cached.teamId, fetchedAt: cached.fetchedAt, error: null };
  }
  try {
    const next = await refresh();
    return { lists: next.lists, teamId: next.teamId, fetchedAt: next.fetchedAt, error: null };
  } catch (e) {
    logError("content:lists", e);
    return { lists: cached?.lists ?? [], teamId: cached?.teamId ?? null, fetchedAt: cached?.fetchedAt ?? null, error: errorMessage(e) };
  }
}

export interface ResolvedContentList {
  list: ClickUpListRef | null;
  /** true = escolhida pelo nome do cliente; false = escolhida no painel. */
  auto: boolean;
  error: string | null;
}

export async function resolveContentList(client: Client, settings: ContentSettings): Promise<ResolvedContentList> {
  const { lists, error } = await getClickUpLists();
  if (settings.listId) {
    const chosen = lists.find((l) => l.id === settings.listId) ?? { id: settings.listId, name: `Lista ${settings.listId}`, folder: null, space: null };
    return { list: chosen, auto: false, error };
  }
  return { list: findClickUpList(client, lists), auto: true, error };
}

function contentWindow(rules: ContentRules) {
  const today = todayISO(env().APP_TIMEZONE);
  return { today, from: addDays(today, -rules.daysBack), to: addDays(today, rules.daysAhead) };
}

async function readFromClickUp(list: ClickUpListRef, window: { from: string; to: string }): Promise<ContentCache> {
  const tz = env().APP_TIMEZONE;
  // Um dia de folga em cada ponta por causa do fuso; o recorte exato é feito na data local.
  const [meta, tasks] = await Promise.all([fetchList(list.id), fetchListTasks(list.id, Date.parse(`${window.from}T00:00:00Z`) - DAY_MS, Date.parse(`${window.to}T23:59:59Z`) + DAY_MS)]);
  const items = tasks.map((t) => normalizeTask(t, tz)).filter((i): i is ContentItem => i !== null && i.date >= window.from && i.date <= window.to);
  return { listId: list.id, listName: meta.name, from: window.from, to: window.to, fetchedAt: new Date().toISOString(), statuses: meta.statuses, typeOptions: typeOptionsFrom(tasks), items, error: null };
}

/**
 * Conteúdos da lista no período das regras. Usa a cópia guardada quando tem menos de 10 minutos;
 * com `allowStale` (portal), uma cópia mais velha da mesma lista é mostrada na hora e atualizada
 * depois da resposta. Se o ClickUp falhar, a última cópia continua valendo.
 */
export async function getContentData(clientId: string, list: ClickUpListRef, rules: ContentRules, options: { force?: boolean; allowStale?: boolean } = {}): Promise<{ cache: ContentCache | null; error: string | null }> {
  const repo = getRepositories().content;
  const window = contentWindow(rules);
  const cached = await repo.getCache(clientId);
  const sameList = cached !== null && cached.listId === list.id;
  const fresh = sameList && cached.from === window.from && cached.to === window.to && Date.now() - Date.parse(cached.fetchedAt) < CONTENT_TTL_MS;
  const recentError = sameList && cached.error !== null && Date.now() - Date.parse(cached.error.at) < RETRY_AFTER_ERROR_MS;
  if (!options.force && (fresh || recentError)) return { cache: cached, error: cached?.error?.message ?? null };

  const refresh = async (): Promise<{ cache: ContentCache | null; error: string | null }> => {
    try {
      const next = await readFromClickUp(list, window);
      await repo.saveCache(clientId, next);
      return { cache: next, error: null };
    } catch (e) {
      logError("content:refresh", e);
      const message = errorMessage(e);
      if (!sameList) return { cache: null, error: message };
      const withError = { ...cached, error: { at: new Date().toISOString(), message } };
      await repo.saveCache(clientId, withError).catch(() => undefined);
      return { cache: withError, error: message };
    }
  };
  if (!options.force && options.allowStale && sameList) {
    inBackground(refresh);
    return { cache: cached, error: cached.error?.message ?? null };
  }
  return refresh();
}

/** O que o cliente vê na área Conteúdo (null = área escondida). Nunca derruba o portal. */
export async function loadPortalContent(client: Client): Promise<PortalContentVM | null> {
  if (!clickupConfigured()) return null;
  try {
    const settings = await getContentSettings(client.id);
    if (!settings.enabled) return null;
    const { list } = await resolveContentList(client, settings);
    if (!list) return null;
    const { cache: data } = await getContentData(client.id, list, settings.rules, { allowStale: true });
    if (!data) return null;
    return buildPortalContent(data.items, settings.rules, todayISO(env().APP_TIMEZONE), data.fetchedAt);
  } catch (e) {
    logError("content:portal", e);
    return null;
  }
}

export interface ContentAdminView {
  configured: boolean;
  settings: ContentSettings;
  resolved: ResolvedContentList;
  lists: ClickUpListRef[];
  teamId: string | null;
  data: ContentCache | null;
  error: string | null;
  today: string;
}

export async function loadContentAdmin(client: Client): Promise<ContentAdminView> {
  const settings = await getContentSettings(client.id);
  const today = todayISO(env().APP_TIMEZONE);
  if (!clickupConfigured()) return { configured: false, settings, resolved: { list: null, auto: true, error: null }, lists: [], teamId: null, data: null, error: null, today };
  const [resolved, catalog] = await Promise.all([resolveContentList(client, settings), getClickUpLists()]);
  const { cache: data, error } = resolved.list ? await getContentData(client.id, resolved.list, settings.rules) : { cache: null, error: null };
  return { configured: true, settings, resolved, lists: catalog.lists, teamId: catalog.teamId, data, error: error ?? resolved.error ?? catalog.error, today };
}

export async function saveContentSettings(clientId: string, input: ContentSettingsInput, actor: string | null): Promise<ContentSettings> {
  const data = ContentSettingsInputSchema.parse(input);
  const client = await requireClient(clientId);
  const saved = await getRepositories().content.updateSettings(clientId, (current) => ({ ...(current ?? defaultSettings(clientId)), ...data }));
  await logEvent("content.updated", { clientId, actor, summary: `Regras da área Conteúdo de ${client.name} atualizadas.` });
  return saved;
}

/** "Atualizar agora": relê as listas do workspace e a lista do cliente, sem esperar os 10 minutos. */
export async function refreshContent(clientId: string): Promise<{ items: number }> {
  if (!clickupConfigured()) throw new UserFacingError("A integração com o ClickUp não está configurada (CLICKUP_API_TOKEN).");
  const client = await requireClient(clientId);
  const settings = await getContentSettings(clientId);
  const catalog = await getClickUpLists({ force: true });
  if (catalog.error) throw new UserFacingError(catalog.error);
  const { list } = await resolveContentList(client, settings);
  if (!list) throw new UserFacingError("Nenhuma lista do ClickUp corresponde a este cliente. Escolha a lista abaixo.");
  const { cache: data, error } = await getContentData(clientId, list, settings.rules, { force: true });
  if (error || !data) throw new UserFacingError(error ?? "Não foi possível ler o ClickUp agora.");
  return { items: data.items.length };
}
