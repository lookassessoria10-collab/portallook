import { isFiniteNumber } from "@/lib/format/number";
import { formatPeriodRange, periodSeriesLabels, periodUnit, type PeriodUnit } from "@/lib/dates/period";
import type { SeriesDef, SeriesPoint } from "@/components/charts/types";
import type { PeriodTableColumn, PeriodTableData } from "@/components/dashboard/period-table";
import type { ReportIndexEntry } from "@/features/reports/schema";
import { SOCIAL_METRICS, socialLabel, type SocialKey } from "./metrics";

export interface SocialOverviewViewModel {
  unit: PeriodUnit;
  count: number;
  rangeLabel: string;
  networkLabel: string;
  points: SeriesPoint[];
  /** Novos seguidores × perdas, por período. */
  growthSeries: SeriesDef[] | null;
  /** Curtidas, comentários, compartilhamentos e salvos, por período. */
  interactionSeries: SeriesDef[] | null;
  /** Alcance e visualizações (ou impressões), por período. */
  audienceSeries: SeriesDef[] | null;
  /** Mês a mês com as mesmas colunas da planilha de análise de dados. */
  table: PeriodTableData;
}

type Values = Record<string, number | null>;

function labelOf(entries: readonly ReportIndexEntry[], key: string): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const label = entries[i].labels[key];
    if (label) return label;
  }
  return null;
}

/**
 * Colunas da planilha de análise de dados, na ordem da maioria das abas. Só números que vêm da
 * planilha — nada calculado pelo portal (taxa de engajamento, saldo, médias, totais).
 */
const SHEET_COLUMNS: Array<{ key: SocialKey; label: string }> = [
  { key: "followers", label: "Seguidores" },
  { key: "newFollowers", label: "Novos seguidores" },
  { key: "lostFollowers", label: "Perdas" },
  { key: "reach", label: "Alcance" },
  { key: "views", label: "Visualizações" },
  { key: "engagement", label: "Engajamento" },
  { key: "profileVisits", label: "Visitas" },
  { key: "interactions", label: "Interações" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Comentários" },
  { key: "shares", label: "Compartilhamentos" },
  { key: "saves", label: "Salvos" },
  { key: "linkClicks", label: "Toques em links" },
];

const columnLabel = (key: SocialKey) => SHEET_COLUMNS.find((c) => c.key === key)?.label ?? SOCIAL_METRICS[key].label;

/**
 * Visão geral de rede social a partir do resumo do índice (sem abrir o data.json): a tabela mês a mês
 * espelha a planilha (mesmas colunas e nomes; "Impressões"/"Visualizações" e "Toque no site"/"Toques
 * em links" como vieram dela, e as colunas extras da aba no fim). `entries` em ordem cronológica.
 */
export function buildSocialOverview(entries: readonly ReportIndexEntry[]): SocialOverviewViewModel {
  const last = entries[entries.length - 1];
  const unit = periodUnit(last.period.granularity);
  const labels = periodSeriesLabels(entries.map((e) => e.period));
  const rows: Values[] = entries.map((e) => ({ ...e.summary }));
  const names: Record<string, string> = {};
  for (const key of ["views", "linkClicks"]) {
    const l = labelOf(entries, key);
    if (l) names[key] = l;
  }
  const label = (key: SocialKey) => (names[key] ? socialLabel(key, names) : columnLabel(key));
  const has = (key: string) => rows.some((r) => isFiniteNumber(r[key]));

  const extraKeys = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => k.startsWith("extra."))))].filter(has);
  const columns: PeriodTableColumn[] = [
    ...SHEET_COLUMNS.filter((c) => has(c.key)).map((c) => ({ key: c.key, label: label(c.key), format: "integer" as const })),
    ...extraKeys.map((k) => ({ key: k, label: labelOf(entries, k) ?? k.slice(6), format: "integer" as const })),
  ];

  const points: SeriesPoint[] = entries.map((e, i) => ({ key: e.periodKey, label: labels[i].axis, fullLabel: labels[i].full, values: rows[i] }));

  const growthSeries: SeriesDef[] = [];
  if (has("newFollowers")) growthSeries.push({ key: "newFollowers", label: "Novos seguidores", format: "integer", slot: 1 });
  if (has("lostFollowers")) growthSeries.push({ key: "lostFollowers", label: "Perdas", format: "integer", color: "var(--chart-other)" });

  const interactionSeries: SeriesDef[] = (["likes", "comments", "shares", "saves"] as const)
    .filter((k) => has(k))
    .map((k, i) => ({ key: k, label: columnLabel(k), format: "integer" as const, slot: (i + 1) as 1 | 2 | 3 | 4 }));

  const audienceSeries: SeriesDef[] = [];
  if (has("reach")) audienceSeries.push({ key: "reach", label: "Alcance", format: "integer", slot: 1 });
  if (has("views")) audienceSeries.push({ key: "views", label: label("views"), format: "integer", slot: 2 });

  return {
    unit,
    count: entries.length,
    rangeLabel: formatPeriodRange(entries[0].period, last.period),
    networkLabel: labelOf(entries, "network") ?? "Instagram",
    points,
    growthSeries: growthSeries.length ? growthSeries : null,
    interactionSeries: interactionSeries.length ? interactionSeries : null,
    audienceSeries: audienceSeries.length ? audienceSeries : null,
    table: {
      groups: [{ key: "total", label: null, columns }],
      rows: entries.map((e, i) => ({ key: e.periodKey, label: labels[i].row, values: rows[i] })),
      // A planilha não tem linha de total: o portal também não soma.
      total: null,
    },
  };
}
