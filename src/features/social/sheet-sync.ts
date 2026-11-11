import "server-only";
import * as XLSX from "xlsx";
import { z } from "zod";
import { after } from "next/server";
import { env } from "@/lib/env";
import { formatPeriod, parsePeriodKey, todayISO } from "@/lib/dates/period";
import { logError } from "@/lib/errors";
import { readJSON, updateJSON } from "@/lib/storage/json";
import { getStorage } from "@/lib/storage";
import { paths } from "@/lib/storage/paths";
import { matrixToSheet } from "@/lib/parsers/sheet";
import { MAX_ROWS_PER_SHEET, type RawWorkbook } from "@/lib/parsers/types";
import { getRepositories } from "@/server/repositories";
import { createDraftReport, getReportManifest, publishReport } from "@/features/reports/service";
import type { ReportIndexEntry } from "@/features/reports/schema";
import type { Client } from "@/features/clients/schema";
import { IssueCollector } from "@/features/uploads/issues";
import { socialLabel, socialSummary } from "./metrics";
import { matchClientSheet, normalizeSocial } from "./normalize";
import { SOCIAL_METRIC_KEYS, SocialDataSchema } from "./schema";

/**
 * Planilha Google de análise de dados de rede social → portal.
 *
 * A planilha (uma aba por cliente, a mesma do upload de Rede social) é lida pelo export
 * XLSX público e passa pelo mesmo normalizador do upload. Regras:
 *
 * - só clientes ativos com o módulo Rede social ligado; abas sem cliente no portal são ignoradas;
 * - só entram meses que ainda NÃO existem no portal (em qualquer status) — nada que já está lá
 *   é alterado. Diferenças entre a planilha e um mês já publicado aparecem só no ADM;
 * - só meses encerrados (o mês corrente ainda está mudando) e do ano atual ou do anterior;
 * - os meses novos são publicados na hora (sem insights; o ADM pode editar depois);
 * - se a aba tiver qualquer erro de leitura, nada é criado para aquele cliente.
 *
 * A leitura é feita no máximo a cada 10 minutos para todos os clientes de uma vez (um download só),
 * disparada pelo portal (depois da resposta) ou pelo botão "Sincronizar agora" do ADM.
 */

export const SHEET_SYNC_TTL_MS = 10 * 60_000;
/** Depois de uma falha, espera 2 minutos antes de tentar de novo. */
const RETRY_AFTER_ERROR_MS = 2 * 60_000;
/** Uma sincronização em andamento "segura" as outras por até 3 minutos (se cair no meio, a trava expira). */
const LOCK_MS = 3 * 60_000;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_BYTES = 40 * 1024 * 1024;
/** O download é reaproveitado por 60 s na mesma instância (vários clientes, ADM e portal). */
const WORKBOOK_MEMORY_MS = 60_000;
const HISTORY = 24;

export const SHEET_SYNC_ACTOR = "Planilha Google (sincronização)";
const SOURCE_FILE_NAME = "Planilha Google · Análise de dados de rede social";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const DiffSchema = z.object({ key: z.string(), label: z.string(), portal: z.number().nullable(), sheet: z.number().nullable() });

const ClientSyncSchema = z.object({
  at: z.string(),
  /** Abas da planilha usadas para o cliente (vazio = nenhuma encontrada). */
  sheets: z.array(z.string()).default([]),
  /** Meses encerrados que a planilha tem para o cliente. */
  months: z.array(z.string()).default([]),
  /** Meses criados pela sincronização (os mais recentes por último). */
  created: z.array(z.object({ periodKey: z.string(), reportId: z.string(), at: z.string() })).default([]),
  /** Meses publicados trocados pela versão da planilha no "Sincronizar agora" (os mais recentes por último). */
  replaced: z.array(z.object({ periodKey: z.string(), reportId: z.string(), at: z.string(), fields: z.array(DiffSchema).default([]) })).default([]),
  /** Meses que já existiam no portal com valores diferentes dos da planilha (não foram alterados). */
  divergent: z.array(z.object({ periodKey: z.string(), fields: z.array(DiffSchema) })).default([]),
  /** Motivo de nada ter sido lido (sem aba, aba com erro…). */
  problem: z.string().nullable().default(null),
});
export type ClientSheetSync = z.infer<typeof ClientSyncSchema>;

const SyncStateSchema = z.object({
  sheetId: z.string().nullable().default(null),
  /** Última leitura completa da planilha. */
  checkedAt: z.string().nullable().default(null),
  /** Última tentativa (com ou sem sucesso). */
  attemptAt: z.string().nullable().default(null),
  runningSince: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
  clients: z.record(z.string(), ClientSyncSchema).default({}),
});
export type SocialSheetState = z.infer<typeof SyncStateSchema>;

const EMPTY_STATE: SocialSheetState = { sheetId: null, checkedAt: null, attemptAt: null, runningSince: null, error: null, clients: {} };

export function socialSheetEnabled(): boolean {
  return env().SOCIAL_SHEET_SYNC === "on";
}

export function socialSheetUrl(): string {
  return `${env().SOCIAL_SHEET_BASE}/${env().SOCIAL_SHEET_ID}/edit`;
}

export class SheetReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetReadError";
  }
}

// ---------------------------------------------------------------------------
// Leitura da planilha

let memory: { sheetId: string; at: number; wb: XLSX.WorkBook; size: number } | null = null;

export function clearSheetMemoryForTesting() {
  memory = null;
}

async function downloadWorkbook(force: boolean): Promise<{ wb: XLSX.WorkBook; size: number }> {
  const { SOCIAL_SHEET_ID: sheetId, SOCIAL_SHEET_BASE: base } = env();
  if (!force && memory && memory.sheetId === sheetId && Date.now() - memory.at < WORKBOOK_MEMORY_MS) return memory;
  let res: Response;
  try {
    res = await fetch(`${base}/${sheetId}/export?format=xlsx`, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    throw new SheetReadError("Não foi possível acessar a planilha do Google agora (sem resposta).");
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new SheetReadError("A planilha do Google não está acessível. Confira se ela continua compartilhada como “Qualquer pessoa com o link pode ver”.");
  }
  if (!res.ok) throw new SheetReadError(`O Google respondeu com erro (${res.status}) ao baixar a planilha.`);
  const body = Buffer.from(await res.arrayBuffer());
  // Planilha que deixou de ser pública devolve a página de login (HTML), não o XLSX.
  if (body.length < 4 || body[0] !== 0x50 || body[1] !== 0x4b) {
    throw new SheetReadError("A planilha do Google não está acessível. Confira se ela continua compartilhada como “Qualquer pessoa com o link pode ver”.");
  }
  if (body.length > MAX_BYTES) throw new SheetReadError("A planilha do Google ficou grande demais para ser lida.");
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(body, { type: "buffer", cellDates: true, cellFormula: false, cellHTML: false, sheetRows: MAX_ROWS_PER_SHEET + 10, WTF: false });
  } catch {
    throw new SheetReadError("Não foi possível ler a planilha do Google (arquivo inválido).");
  }
  memory = { sheetId, at: Date.now(), wb, size: body.length };
  return memory;
}

/** Só as abas do cliente, no formato que o normalizador do upload recebe. */
function clientWorkbook(wb: XLSX.WorkBook, names: string[]): RawWorkbook {
  const sheets = names.map((name) => {
    const ws = wb.Sheets[name];
    const matrix = ws ? (XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][]) : [];
    return matrixToSheet(name, matrix);
  });
  return { format: "xlsx", sheets, sheetNames: [...wb.SheetNames] };
}

// ---------------------------------------------------------------------------
// Estado

const store = () => getStorage();

export async function getSocialSheetState(): Promise<SocialSheetState> {
  try {
    return (await readJSON(store(), paths.socialSheetState(), SyncStateSchema))?.data ?? EMPTY_STATE;
  } catch (e) {
    logError("social-sheet:state", e);
    return EMPTY_STATE;
  }
}

function isStale(state: SocialSheetState, now: number): boolean {
  if (state.runningSince && now - Date.parse(state.runningSince) < LOCK_MS) return false;
  if (state.sheetId !== env().SOCIAL_SHEET_ID) return true;
  if (state.error && state.attemptAt && now - Date.parse(state.attemptAt) < RETRY_AFTER_ERROR_MS) return false;
  return !state.checkedAt || now - Date.parse(state.checkedAt) >= SHEET_SYNC_TTL_MS;
}

/** Marca a sincronização como em andamento. false = outra já está rodando (ou, sem `force`, nada a fazer). */
async function claim(force: boolean): Promise<boolean> {
  let claimed = false;
  await updateJSON(store(), paths.socialSheetState(), SyncStateSchema, (current) => {
    const state = current ?? EMPTY_STATE;
    const now = Date.now();
    const running = state.runningSince !== null && now - Date.parse(state.runningSince) < LOCK_MS;
    claimed = !running && (force || isStale(state, now));
    if (!claimed) return state;
    const at = new Date(now).toISOString();
    return { ...state, runningSince: at, attemptAt: at };
  });
  return claimed;
}

// ---------------------------------------------------------------------------
// Sincronização

export interface SocialSheetSyncResult {
  ran: boolean;
  error: string | null;
  /** Meses publicados por cliente nesta execução. */
  created: Record<string, string[]>;
  /** Meses publicados trocados pela versão da planilha, por cliente. */
  replaced: Record<string, string[]>;
  clients: Record<string, ClientSheetSync>;
}

const clientNames = (c: Client) => [c.name, c.shortName, c.slug];

/** O relatório do mês que o portal mostra (publicado primeiro; senão o mais novo). */
function visibleEntry(list: ReportIndexEntry[]): ReportIndexEntry | null {
  const rank = (s: string) => (s === "published" ? 0 : s === "draft" ? 1 : 2);
  return [...list].filter((e) => e.kind === "dataset").sort((a, b) => rank(a.status) - rank(b.status) || (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null;
}

async function syncClient(client: Client, wb: XLSX.WorkBook, size: number, today: string, previous: ClientSheetSync | undefined, replaceChanged: boolean): Promise<ClientSheetSync> {
  const at = new Date().toISOString();
  const base: ClientSheetSync = { at, sheets: [], months: [], created: previous?.created ?? [], replaced: previous?.replaced ?? [], divergent: [], problem: null };
  const match = matchClientSheet(wb.SheetNames, clientNames(client));
  if (match.kind === "none") return { ...base, problem: "A planilha não tem uma aba com o nome deste cliente." };
  if (match.kind === "ambiguous") return { ...base, problem: `Mais de uma aba parece ser deste cliente: ${match.names.map((n) => n.trim()).join(", ")}.` };

  const issues = new IssueCollector();
  const result = normalizeSocial(clientWorkbook(wb, match.names), { requestedPeriod: null, clientNames: clientNames(client), today, fileName: null }, issues);
  const sheets = match.names.map((n) => n.trim());
  if (issues.hasErrors) return { ...base, sheets, problem: `A aba tem erro de leitura e nada foi atualizado: ${issues.errors[0].message}` };

  const thisYear = +today.slice(0, 4);
  // Mês encerrado (o corrente ainda muda) e do ano atual ou do anterior.
  const closed = result.periods.filter((p) => p.period.end < today && +p.period.start.slice(0, 4) >= thisYear - 1);
  const months = closed.map((p) => p.periodKey);

  const repos = getRepositories();
  // Índice lido na hora (sem cache): um upload feito há pouco conta como mês existente.
  const index = await repos.reports.getIndex(client.id);
  const created = [...base.created];
  const replaced = [...base.replaced];
  const divergent: ClientSheetSync["divergent"] = [];
  for (const p of closed) {
    const data = SocialDataSchema.parse(p.data);
    const existing = index.reports.filter((r) => r.type === "social" && r.periodKey === p.periodKey);
    if (existing.length) {
      const entry = visibleEntry(existing);
      if (!entry) continue;
      const { summary, labels } = socialSummary(data);
      const fields = SOCIAL_METRIC_KEYS.filter((k) => summary[k] !== null && summary[k] !== undefined && summary[k] !== (entry.summary[k] ?? null)).map((k) => ({
        key: k,
        label: socialLabel(k, labels),
        portal: entry.summary[k] ?? null,
        sheet: summary[k] ?? null,
      }));
      if (!fields.length) continue;
      // "Sincronizar agora": o mês publicado que mudou na planilha ganha uma versão nova (a anterior fica no
      // histórico como substituída), com o título e os insights escritos no ADM. Rascunho, retirado ou
      // arquivado nunca são trocados; a leitura automática só aponta as diferenças.
      if (replaceChanged && entry.status === "published") {
        const current = await getReportManifest(client.id, entry.id);
        const draft = await createDraftReport({
          clientId: client.id,
          type: "social",
          kind: "dataset",
          period: p.period,
          title: current?.title ?? null,
          source: { type: "xlsx", fileName: SOURCE_FILE_NAME, size, contentType: XLSX_MIME },
          data: { type: "social", data },
          insights: current?.insights ?? [],
          allowDownload: false,
        });
        await publishReport(client.id, draft.id, SHEET_SYNC_ACTOR);
        replaced.push({ periodKey: p.periodKey, reportId: draft.id, at: new Date().toISOString(), fields });
        continue;
      }
      divergent.push({ periodKey: p.periodKey, fields });
      continue;
    }
    const draft = await createDraftReport({
      clientId: client.id,
      type: "social",
      kind: "dataset",
      period: p.period,
      source: { type: "xlsx", fileName: SOURCE_FILE_NAME, size, contentType: XLSX_MIME },
      data: { type: "social", data },
      allowDownload: false,
    });
    await publishReport(client.id, draft.id, SHEET_SYNC_ACTOR);
    created.push({ periodKey: p.periodKey, reportId: draft.id, at: new Date().toISOString() });
  }
  return { ...base, sheets, months, created: created.slice(-HISTORY), replaced: replaced.slice(-HISTORY), divergent };
}

/**
 * Lê a planilha e publica os meses que faltam em todos os clientes elegíveis.
 * Sem `force`, só roda se a última leitura tiver mais de 10 minutos. Nunca roda duas ao mesmo tempo.
 */
export async function syncSocialSheet(options: { force?: boolean; replaceChanged?: boolean } = {}): Promise<SocialSheetSyncResult> {
  const empty: SocialSheetSyncResult = { ran: false, error: null, created: {}, replaced: {}, clients: {} };
  if (!socialSheetEnabled()) return empty;
  if (!(await claim(Boolean(options.force)))) return empty;

  const sheetId = env().SOCIAL_SHEET_ID;
  const previous = await getSocialSheetState();
  const today = todayISO(env().APP_TIMEZONE);
  const clients: Record<string, ClientSheetSync> = {};
  const created: Record<string, string[]> = {};
  const replaced: Record<string, string[]> = {};
  let error: string | null = null;
  try {
    const { wb, size } = await downloadWorkbook(Boolean(options.force));
    const all = await getRepositories().clients.list();
    for (const client of all) {
      if (client.status !== "active" || !client.modules.social.enabled) continue;
      const before = previous.sheetId === sheetId ? previous.clients[client.id] : undefined;
      try {
        const next = await syncClient(client, wb, size, today, before, Boolean(options.replaceChanged));
        clients[client.id] = next;
        const fresh = next.created.filter((c) => !before?.created.some((b) => b.reportId === c.reportId)).map((c) => c.periodKey);
        if (fresh.length) created[client.id] = fresh;
        const swapped = next.replaced.filter((c) => !before?.replaced.some((b) => b.reportId === c.reportId)).map((c) => c.periodKey);
        if (swapped.length) replaced[client.id] = swapped;
      } catch (e) {
        logError("social-sheet:client", e);
        clients[client.id] = { at: new Date().toISOString(), sheets: [], months: [], created: before?.created ?? [], replaced: before?.replaced ?? [], divergent: [], problem: "Falha ao atualizar este cliente. Tente “Sincronizar agora” de novo." };
      }
    }
  } catch (e) {
    if (!(e instanceof SheetReadError)) logError("social-sheet:sync", e);
    error = e instanceof SheetReadError ? e.message : "Não foi possível ler a planilha do Google agora.";
  }

  const finishedAt = new Date().toISOString();
  await updateJSON(store(), paths.socialSheetState(), SyncStateSchema, (current) => {
    const state = current ?? EMPTY_STATE;
    const keep = state.sheetId === sheetId ? state.clients : {};
    return {
      sheetId,
      checkedAt: error ? state.checkedAt : finishedAt,
      attemptAt: finishedAt,
      runningSince: null,
      error,
      // Com erro de download, o retrato anterior de cada cliente continua valendo.
      clients: error ? keep : clients,
    };
  }).catch((e) => logError("social-sheet:state", e));
  return { ran: true, error, created, replaced, clients };
}

/**
 * Portal: se a última leitura passou de 10 minutos, sincroniza depois da resposta. Com `waitMs`,
 * espera até esse tempo para a página já sair com os meses novos (o resto continua em segundo plano).
 * Nunca derruba o portal.
 */
export async function refreshSocialSheetIfStale(options: { waitMs?: number } = {}): Promise<void> {
  if (!socialSheetEnabled()) return;
  try {
    const state = await getSocialSheetState();
    if (!isStale(state, Date.now())) return;
    const run = syncSocialSheet().catch((e) => logError("social-sheet:background", e));
    try {
      after(() => run);
    } catch {
      // Fora de uma requisição: a promessa segue sozinha.
    }
    if (options.waitMs) await Promise.race([run, new Promise((r) => setTimeout(r, options.waitMs))]);
  } catch (e) {
    logError("social-sheet:refresh", e);
  }
}

export function describeMonths(keys: readonly string[]): string {
  return keys.map((k) => { const p = parsePeriodKey(k); return p ? formatPeriod(p) : k; }).join(", ");
}
