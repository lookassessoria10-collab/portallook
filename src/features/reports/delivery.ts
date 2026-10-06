import type { ModuleConfig } from "@/features/clients/schema";
import {
  addDays,
  diffDays,
  isoFromParts,
  monthPeriod,
  nextPeriod,
  periodKey,
  previousPeriod,
  startOfWeek,
  weekPeriod,
  type Period,
} from "@/lib/dates/period";
import type { ImportIndexEntry, ReportIndexEntry } from "./schema";

export type DeliveryState = "updated" | "pending" | "draft" | "error" | "upcoming" | "not_applicable";

export const DELIVERY_LABEL: Record<DeliveryState, string> = {
  updated: "Atualizado",
  pending: "Pendente",
  draft: "Rascunho",
  error: "Com erro",
  upcoming: "No prazo",
  not_applicable: "Não aplicável",
};

export interface DeliveryStatus {
  state: DeliveryState;
  /** Período que já deveria ter sido entregue até hoje. */
  expectedPeriod: Period | null;
  expectedDueDate: string | null;
  daysOverdue: number | null;
  nextPeriod: Period | null;
  nextDueDate: string | null;
  latestPublished: ReportIndexEntry | null;
  expectedReport: ReportIndexEntry | null;
}

/** Relatório do mês M vence no dia `dueDay` do mês M+1; o plano do mês M (planejamento), no dia `dueDay` do próprio mês. */
function monthlyDueDate(p: Period, dueDay: number, planning = false): string {
  const month = planning ? p : nextPeriod(p);
  const [y, m] = month.start.split("-").map(Number);
  return isoFromParts(y, m, dueDay);
}

/** Semana (segunda a domingo) vence no próximo dia da semana `dueDay` após o domingo. */
function weeklyDueDate(p: Period, dueDay: number): string {
  return addDays(p.end, dueDay);
}

export function dueDateFor(module: ModuleConfig, period: Period, planning = false): string {
  return module.cadence === "monthly" ? monthlyDueDate(period, module.dueDay, planning) : weeklyDueDate(period, module.dueDay);
}

/**
 * O período mais recente cujo prazo já passou (ou vence hoje). Em planejamento
 * (plano de mídia) o próprio mês corrente já pode estar vencido.
 */
export function expectedPeriodFor(module: ModuleConfig, today: string, planning = false): Period {
  if (module.cadence === "monthly") {
    const [y, m] = today.split("-").map(Number);
    const current = monthPeriod(y, m);
    const candidate = planning ? current : previousPeriod(current);
    return today >= monthlyDueDate(candidate, module.dueDay, planning) ? candidate : previousPeriod(candidate);
  }
  const lastWeek = weekPeriod(addDays(startOfWeek(today), -7));
  return today >= weeklyDueDate(lastWeek, module.dueDay) ? lastWeek : previousPeriod(lastWeek);
}

const ERROR_STATUSES = new Set(["invalid", "failed"]);

export function computeDelivery(input: {
  module: ModuleConfig;
  reports: readonly ReportIndexEntry[];
  imports?: readonly ImportIndexEntry[];
  today: string;
  /** Data de cadastro (ISO) — evita marcar pendência de períodos anteriores ao início. */
  clientSince?: string;
  /** Plano de mídia: o período entregue é o mês que começa, não o que terminou. */
  planning?: boolean;
}): DeliveryStatus {
  const { module, today } = input;
  const empty: DeliveryStatus = {
    state: "not_applicable",
    expectedPeriod: null,
    expectedDueDate: null,
    daysOverdue: null,
    nextPeriod: null,
    nextDueDate: null,
    latestPublished: null,
    expectedReport: null,
  };
  if (!module.enabled) return empty;

  const planning = input.planning ?? false;
  const expected = expectedPeriodFor(module, today, planning);
  const key = periodKey(expected);
  const expectedDueDate = dueDateFor(module, expected, planning);
  const upcoming = nextPeriod(expected);
  const datasets = input.reports.filter((r) => r.status !== "archived");
  const published = datasets.filter((r) => r.status === "published");
  const latestPublished = [...published].sort((a, b) => (a.period.start < b.period.start ? 1 : -1))[0] ?? null;

  const forPeriod = datasets.filter((r) => r.periodKey === key);
  const publishedForPeriod = forPeriod.find((r) => r.status === "published") ?? null;
  const draftForPeriod = forPeriod.find((r) => r.status === "draft") ?? null;

  const base: DeliveryStatus = {
    ...empty,
    expectedPeriod: expected,
    expectedDueDate,
    nextPeriod: upcoming,
    nextDueDate: dueDateFor(module, upcoming, planning),
    latestPublished,
    expectedReport: publishedForPeriod ?? draftForPeriod,
  };

  // Entregas de períodos posteriores também contam (ex.: relatório adiantado).
  if (publishedForPeriod || (latestPublished && latestPublished.period.start > expected.start)) {
    return { ...base, state: "updated" };
  }

  const latestImport = [...(input.imports ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (latestImport && ERROR_STATUSES.has(latestImport.status)) return { ...base, state: "error" };
  if (draftForPeriod) return { ...base, state: "draft" };

  const since = input.clientSince?.slice(0, 10);
  if (!input.reports.length && since && since > expectedDueDate) return { ...base, state: "upcoming" };

  return { ...base, state: "pending", daysOverdue: Math.max(0, diffDays(today, expectedDueDate)) };
}
