import { ACTION_STAGES, ACTION_STAGE_LABEL, ACTION_STATUSES, ACTION_STATUS_STAGE, type ActionKind, type ActionStage, type ActionStatus, type ClientAction } from "./schema";

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

/** Seção do portal: a etapa que o status escolhido no painel indica (ver `ACTION_STATUS_STAGE`). */
export type PortalActionGroupKey = ActionStage;

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

export interface PortalActionGroup {
  status: PortalActionGroupKey;
  label: string;
  items: PortalActionItem[];
}

/** Contagem por etapa: os cartões do resumo somam o total e batem com as seções. */
export interface PortalActionsCounts {
  total: number;
  planned: number;
  awaiting: number;
  /** Aprovadas, em andamento e aguardando retorno. */
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

/** Contagem por etapa do portal — a mesma no painel da Look e no portal do cliente. */
export function countStages(items: readonly Pick<ClientAction, "status">[]): PortalActionsCounts {
  const n = (stage: ActionStage) => items.filter((a) => ACTION_STATUS_STAGE[a.status] === stage).length;
  return { total: items.length, planned: n("planned"), awaiting: n("suggested"), active: n("in_progress"), done: n("done"), rejected: n("rejected") };
}

/** Previstas: da execução mais próxima para a mais distante (sem data no fim). */
const byNextDate = (a: PortalActionItem, b: PortalActionItem) => (a.executedAt && b.executedAt ? a.executedAt.localeCompare(b.executedAt) : a.executedAt ? -1 : b.executedAt ? 1 : 0);

/** Ações visíveis do cliente → portal. null quando não há nada para mostrar. */
export function buildPortalActions(items: readonly ClientAction[], updatedAt: string | null, today: string): PortalActionsVM | null {
  const visible = items.filter((a) => a.visible);
  if (!visible.length) return null;
  // Prevista não leva data de apresentação ao portal: só a execução prevista, que o card mostra como mês e ano.
  const sorted = sortActions(visible).map(
    (a): PortalActionItem => ({ id: a.id, title: a.title, category: a.category, kind: a.kind, status: a.status, suggestedAt: a.status === "planned" ? null : a.suggestedAt, executedAt: a.executedAt, note: a.clientNote }),
  );
  const groups = ACTION_STAGES.map((stage): PortalActionGroup => {
    const list = sorted.filter((a) => ACTION_STATUS_STAGE[a.status] === stage);
    if (stage === "planned") list.sort(byNextDate);
    return { status: stage, label: ACTION_STAGE_LABEL[stage], items: list };
  }).filter((g) => g.items.length);
  return { summary: summarizeActions(visible, today), counts: countStages(visible), groups, updatedAt, today };
}
