import { ACTION_STATUSES, ACTION_STATUS_CLIENT_LABEL, type ActionKind, type ActionStatus, type ClientAction } from "./schema";

/** Indicadores do painel de ações (os mesmos da aba "Dashboad" da planilha). */
export interface ActionsSummary {
  total: number;
  byStatus: Record<ActionStatus, number>;
  /** Ações com data de execução preenchida, qualquer que seja o status. */
  executed: number;
  oneOff: number;
  continuous: number;
  /** Frentes por quantidade de ações (as sem frente ficam de fora). */
  categories: Array<{ label: string; count: number }>;
}

type Summarizable = Pick<ClientAction, "status" | "executedAt" | "kind" | "category">;

/** Com `today`, só conta como executada a ação com data de execução até hoje (as futuras são previstas). */
export function summarizeActions(items: readonly Summarizable[], today?: string): ActionsSummary {
  const byStatus = Object.fromEntries(ACTION_STATUSES.map((s) => [s, 0])) as Record<ActionStatus, number>;
  const categories = new Map<string, number>();
  let executed = 0;
  let oneOff = 0;
  let continuous = 0;
  for (const a of items) {
    byStatus[a.status] += 1;
    if (a.executedAt && (!today || a.executedAt <= today)) executed += 1;
    if (a.kind === "one_off") oneOff += 1;
    if (a.kind === "continuous") continuous += 1;
    if (a.category) categories.set(a.category, (categories.get(a.category) ?? 0) + 1);
  }
  return {
    total: items.length,
    byStatus,
    executed,
    oneOff,
    continuous,
    categories: [...categories].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
  };
}

/** Data de referência da ação: execução, senão sugestão. */
export const actionDate = (a: Pick<ClientAction, "executedAt" | "suggestedAt">) => a.executedAt ?? a.suggestedAt;

/** Mais recentes primeiro; ações sem data no fim, na ordem da planilha. */
export function sortActions<T extends Pick<ClientAction, "executedAt" | "suggestedAt">>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index, date: actionDate(item) }))
    .sort((a, b) => (a.date && b.date ? (a.date < b.date ? 1 : a.date > b.date ? -1 : a.index - b.index) : a.date ? -1 : b.date ? 1 : a.index - b.index))
    .map((x) => x.item);
}

/** O que o portal mostra de cada ação — nunca as observações internas. */
export interface PortalActionItem {
  id: string;
  title: string;
  category: string;
  kind: ActionKind | null;
  status: ActionStatus;
  suggestedAt: string | null;
  executedAt: string | null;
  note: string;
}

/** Grupos do portal: os status, mais "planned" (ações com execução marcada para depois de hoje). */
export type PortalActionGroupKey = ActionStatus | "planned";

export interface PortalActionGroup {
  status: PortalActionGroupKey;
  label: string;
  items: PortalActionItem[];
}

export interface PortalActionsVM {
  summary: ActionsSummary;
  groups: PortalActionGroup[];
  /** Data da última alteração no painel (null = dados da planilha). */
  updatedAt: string | null;
  /** Hoje (AAAA-MM-DD): datas de execução depois dele aparecem como previstas. */
  today: string;
}

/**
 * Ordem das seções no portal: o que vai acontecer (previstas), o que está acontecendo,
 * o que já foi feito e as próximas ideias.
 */
const PORTAL_GROUP_ORDER: ActionStatus[] = ["in_progress", "pending", "done", "approved", "suggested", "rejected"];

/** Ação prevista: execução marcada para depois de hoje (concluídas e não aprovadas nunca são previstas). */
export const isPlannedAction = (a: Pick<ClientAction, "status" | "executedAt">, today: string) =>
  Boolean(a.executedAt && a.executedAt > today && a.status !== "done" && a.status !== "rejected");

/** Ações visíveis do cliente → portal. null quando não há nada para mostrar. */
export function buildPortalActions(items: readonly ClientAction[], updatedAt: string | null, today: string): PortalActionsVM | null {
  const visible = items.filter((a) => a.visible);
  if (!visible.length) return null;
  const sorted = sortActions(visible).map(
    (a): PortalActionItem => ({ id: a.id, title: a.title, category: a.category, kind: a.kind, status: a.status, suggestedAt: a.suggestedAt, executedAt: a.executedAt, note: a.clientNote }),
  );
  // Previstas primeiro, da execução mais próxima para a mais distante; elas saem do grupo do status.
  const planned = sorted.filter((a) => isPlannedAction(a, today)).sort((a, b) => a.executedAt!.localeCompare(b.executedAt!));
  const rest = sorted.filter((a) => !isPlannedAction(a, today));
  const groups: PortalActionGroup[] = [
    { status: "planned" as const, label: "Previstas", items: planned },
    ...PORTAL_GROUP_ORDER.map((status) => ({ status, label: ACTION_STATUS_CLIENT_LABEL[status], items: rest.filter((a) => a.status === status) })),
  ].filter((g) => g.items.length);
  return { summary: summarizeActions(visible, today), groups, updatedAt, today };
}
