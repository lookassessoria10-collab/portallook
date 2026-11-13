import { ACTION_STATUSES, type ActionKind, type ActionStatus, type ClientAction } from "./schema";

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

/**
 * Etapa da ação para o cliente — o fluxo do portal:
 * Prevista (a apresentar ou com execução marcada) → Aguardando aprovação → Aprovada (a executar)
 * → Em andamento / Pendente → Concluída, ou Não aprovada.
 */
export type PortalActionGroupKey = ActionStatus | "planned";

/** O que o portal mostra de cada ação — nunca as observações internas. */
export interface PortalActionItem {
  id: string;
  title: string;
  category: string;
  kind: ActionKind | null;
  status: ActionStatus;
  /** Grupo do portal (a etapa). */
  stage: PortalActionGroupKey;
  /** Etiqueta do card: o status, corrigido pelas datas (ver `portalBadge`). */
  badge: PortalActionBadge;
  suggestedAt: string | null;
  executedAt: string | null;
  note: string;
}

export interface PortalActionGroup {
  status: PortalActionGroupKey;
  label: string;
  items: PortalActionItem[];
}

/** Contagem por etapa: os cartões do resumo somam sempre o total. */
export interface PortalActionsCounts {
  total: number;
  planned: number;
  awaiting: number;
  /** Aprovadas a executar, em andamento e pendentes. */
  active: number;
  done: number;
  rejected: number;
}

export interface PortalActionsVM {
  summary: ActionsSummary;
  counts: PortalActionsCounts;
  groups: PortalActionGroup[];
  /** Data da última alteração no painel (null = dados da planilha). */
  updatedAt: string | null;
  /** Hoje (AAAA-MM-DD): datas depois dele aparecem como previstas. */
  today: string;
}

/**
 * Ordem das seções no portal: o que vai acontecer (previstas), o que está acontecendo,
 * o que já foi feito e o que espera decisão do cliente.
 */
const PORTAL_GROUP_ORDER: PortalActionGroupKey[] = ["planned", "in_progress", "pending", "approved", "done", "suggested", "rejected"];

export const PORTAL_GROUP_LABEL: Record<PortalActionGroupKey, string> = {
  planned: "Previstas",
  in_progress: "Em andamento",
  pending: "Pendentes",
  approved: "Aprovadas, a executar",
  done: "Concluídas",
  suggested: "Aguardando aprovação",
  rejected: "Não aprovadas",
};

type Staged = Pick<ClientAction, "status" | "suggestedAt" | "executedAt">;

/** Sugestão ainda não apresentada ao cliente: sem status e com data de sugestão depois de hoje. */
export const isUpcomingSuggestion = (a: Staged, today: string) => a.status === "suggested" && Boolean(a.suggestedAt && a.suggestedAt > today);

/** Ação prevista: sugestão ainda a apresentar, ou execução marcada para depois de hoje (concluídas e não aprovadas nunca são previstas). */
export const isPlannedAction = (a: Staged, today: string) =>
  a.status !== "done" && a.status !== "rejected" && (isUpcomingSuggestion(a, today) || Boolean(a.executedAt && a.executedAt > today));

/**
 * Etapa da ação no portal. A planilha marca como "Aprovado" ações que já foram executadas:
 * para o cliente, aprovada com execução até hoje é concluída (o mesmo vale para uma sugestão já executada).
 */
export function portalStage(a: Staged, today: string): PortalActionGroupKey {
  if (isPlannedAction(a, today)) return "planned";
  if ((a.status === "approved" || a.status === "suggested") && a.executedAt && a.executedAt <= today) return "done";
  return a.status;
}

/** Etiqueta do card: "upcoming" = sugestão a apresentar; aprovada já executada vira "done". */
export type PortalActionBadge = ActionStatus | "upcoming";

export function portalBadge(a: Staged, today: string): PortalActionBadge {
  if (isUpcomingSuggestion(a, today)) return "upcoming";
  return portalStage(a, today) === "done" ? "done" : a.status;
}

/** Data que põe a ação em Previstas: a apresentação, senão a execução. */
const plannedDate = (a: Staged, today: string) => (isUpcomingSuggestion(a, today) ? a.suggestedAt! : a.executedAt!);

/** Ações visíveis do cliente → portal. null quando não há nada para mostrar. */
export function buildPortalActions(items: readonly ClientAction[], updatedAt: string | null, today: string): PortalActionsVM | null {
  const visible = items.filter((a) => a.visible);
  if (!visible.length) return null;
  const sorted = sortActions(visible).map(
    (a): PortalActionItem => ({
      id: a.id,
      title: a.title,
      category: a.category,
      kind: a.kind,
      status: a.status,
      stage: portalStage(a, today),
      badge: portalBadge(a, today),
      suggestedAt: a.suggestedAt,
      executedAt: a.executedAt,
      note: a.clientNote,
    }),
  );
  const groups = PORTAL_GROUP_ORDER.map((status): PortalActionGroup => {
    const list = sorted.filter((a) => a.stage === status);
    // Previstas: da data mais próxima para a mais distante.
    if (status === "planned") list.sort((a, b) => plannedDate(a, today).localeCompare(plannedDate(b, today)));
    return { status, label: PORTAL_GROUP_LABEL[status], items: list };
  }).filter((g) => g.items.length);
  const n = (key: PortalActionGroupKey) => sorted.filter((a) => a.stage === key).length;
  const counts: PortalActionsCounts = {
    total: sorted.length,
    planned: n("planned"),
    awaiting: n("suggested"),
    active: n("approved") + n("in_progress") + n("pending"),
    done: n("done"),
    rejected: n("rejected"),
  };
  return { summary: summarizeActions(visible, today), counts, groups, updatedAt, today };
}
