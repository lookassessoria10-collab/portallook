import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { UserFacingError } from "@/lib/errors";
import type { ClickUpListRef } from "./schema";

/**
 * Cliente mínimo da API v2 do ClickUp — somente leitura. O token fica no servidor
 * (CLICKUP_API_TOKEN) e nunca vai para o navegador.
 */
export class ClickUpError extends UserFacingError {
  constructor(message: string, public readonly status: number | null = null) {
    super(message, "clickup");
    this.name = "ClickUpError";
  }
}

const TIMEOUT_MS = 10_000;
/** Até 10 páginas de 100 tarefas por lista e período. */
const MAX_PAGES = 10;

export function clickupConfigured(): boolean {
  return Boolean(env().CLICKUP_API_TOKEN);
}

async function get(path: string, query: Record<string, string> = {}): Promise<unknown> {
  const { CLICKUP_API_TOKEN: token, CLICKUP_API_BASE: base } = env();
  if (!token) throw new ClickUpError("A integração com o ClickUp não está configurada (CLICKUP_API_TOKEN).");
  const url = new URL(`${base.replace(/\/$/, "")}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ClickUpError("Não foi possível falar com o ClickUp agora. Tente de novo em instantes.");
  }
  if (res.status === 401) throw new ClickUpError("O ClickUp recusou o token configurado (CLICKUP_API_TOKEN).", 401);
  if (res.status === 404) throw new ClickUpError("Lista não encontrada no ClickUp (ou o token não tem acesso a ela).", 404);
  if (res.status === 429) throw new ClickUpError("O ClickUp limitou as consultas por alguns instantes. Tente de novo em um minuto.", 429);
  if (!res.ok) throw new ClickUpError(`O ClickUp respondeu com erro (${res.status}).`, res.status);
  return res.json();
}

const TeamsSchema = z.looseObject({ teams: z.array(z.looseObject({ id: z.union([z.string(), z.number()]) })) });
const SpacesSchema = z.looseObject({ spaces: z.array(z.looseObject({ id: z.union([z.string(), z.number()]), name: z.string() })) });
const ListRefSchema = z.looseObject({ id: z.union([z.string(), z.number()]), name: z.string() });
const FoldersSchema = z.looseObject({ folders: z.array(z.looseObject({ name: z.string(), lists: z.array(ListRefSchema).default([]) })) });
const ListsSchema = z.looseObject({ lists: z.array(ListRefSchema) });
const ListSchema = z.looseObject({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  statuses: z.array(z.looseObject({ status: z.string(), color: z.string().nullable().optional(), type: z.string().nullable().optional() })).default([]),
});
const TasksPageSchema = z.looseObject({ tasks: z.array(z.unknown()), last_page: z.boolean().optional() });

function parse<S extends z.ZodType>(schema: S, data: unknown, what: string): z.output<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ClickUpError(`Resposta inesperada do ClickUp (${what}).`);
  return parsed.data;
}

/** Todas as listas do workspace (pastas e listas soltas de cada espaço). */
export async function fetchWorkspaceLists(): Promise<{ teamId: string; lists: ClickUpListRef[] }> {
  let teamId = env().CLICKUP_TEAM_ID;
  if (!teamId) {
    const teams = parse(TeamsSchema, await get("/team"), "workspaces").teams;
    if (!teams.length) throw new ClickUpError("O token do ClickUp não tem acesso a nenhum workspace.");
    teamId = String(teams[0].id);
  }
  const spaces = parse(SpacesSchema, await get(`/team/${teamId}/space`, { archived: "false" }), "espaços").spaces;
  const lists: ClickUpListRef[] = [];
  for (const space of spaces) {
    const [folders, loose] = await Promise.all([
      get(`/space/${space.id}/folder`, { archived: "false" }).then((d) => parse(FoldersSchema, d, "pastas").folders),
      get(`/space/${space.id}/list`, { archived: "false" }).then((d) => parse(ListsSchema, d, "listas").lists),
    ]);
    for (const folder of folders) for (const l of folder.lists) lists.push({ id: String(l.id), name: l.name, folder: folder.name, space: space.name });
    for (const l of loose) lists.push({ id: String(l.id), name: l.name, folder: null, space: space.name });
  }
  return { teamId, lists };
}

export async function fetchList(listId: string): Promise<{ id: string; name: string; statuses: Array<{ name: string; color: string | null; type: string | null }> }> {
  const list = parse(ListSchema, await get(`/list/${encodeURIComponent(listId)}`), "lista");
  return { id: String(list.id), name: list.name, statuses: list.statuses.map((s) => ({ name: s.status, color: s.color ?? null, type: s.type ?? null })) };
}

/** Tarefas com data de entrega no período (inclui as fechadas e as subtarefas). */
export async function fetchListTasks(listId: string, fromMs: number, toMs: number): Promise<unknown[]> {
  const tasks: unknown[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = parse(
      TasksPageSchema,
      await get(`/list/${encodeURIComponent(listId)}/task`, {
        archived: "false",
        include_closed: "true",
        subtasks: "true",
        order_by: "due_date",
        reverse: "true",
        due_date_gt: String(fromMs),
        due_date_lt: String(toMs),
        page: String(page),
      }),
      "tarefas",
    );
    tasks.push(...data.tasks);
    if (data.last_page !== false || data.tasks.length < 100) break;
  }
  return tasks;
}
