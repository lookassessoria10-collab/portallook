import { MONTHS_PT, MONTHS_SHORT_PT, formatPeriod, monthPeriod, periodKey, type Period } from "@/lib/dates/period";
import { normalizeText, slugify } from "@/lib/ids";
import { describeCell, findColumn, monthCell, numberCell, textCell } from "@/lib/parsers/cells";
import type { CellValue, RawSheet, RawWorkbook } from "@/lib/parsers/types";
import type { IssueCollector } from "@/features/uploads/issues";
import { isTotalLabel } from "@/features/uploads/row-period";
import type { ParsedPeriod } from "@/features/uploads/parsed";
import { NETWORK_LABEL, type SocialDataInput, type SocialExtraMetric, type SocialMetricKey, type SocialMetrics, type SocialNetwork } from "./schema";

/**
 * Planilha de análise de dados de rede social → um relatório por mês.
 *
 * Formato da Look (uma aba por cliente, com o nome do cliente):
 *
 *   linha 1   ANÁLISE DE DADOS - INSTAGRAM [- 2024]        ← título: rede e, se houver, o ano
 *   linha 2   MÊS | SEGUIDORES | NOVOS SEGUIDORES | PERDAS | ALCANCE | VISUALIZAÇÕES | …
 *   linhas    JANEIRO … DEZEMBRO (meses ainda sem números são ignorados)
 *   depois    OBSERVAÇÃO (interna, vira aviso para o ADM) e o glossário (ignorado)
 *
 * A planilha inteira (todas as abas) pode ser enviada: a aba do cliente é encontrada
 * pelo nome. Também aceita uma aba só, CSV ou a tabela colada, com as mesmas colunas.
 */

const PERIOD = ["mes", "meses", "periodo", "mes de referencia", "competencia", "referencia", "month"];

/** Ordem importa: "Novos seguidores" e "Perdas" são resolvidos antes de "Seguidores". */
const COLUMN_ALIASES: Array<[SocialMetricKey, string[]]> = [
  ["newFollowers", ["novos seguidores", "seguidores novos", "ganho de seguidores", "seguidores ganhos", "novos", "new followers"]],
  ["lostFollowers", ["perdas", "perda", "perda de seguidores", "perdas de seguidores", "seguidores perdidos", "deixaram de seguir", "unfollows"]],
  ["followers", ["seguidores", "total de seguidores", "seguidores totais", "followers"]],
  ["reach", ["alcance", "contas alcancadas", "reach"]],
  ["views", ["visualizacoes", "impressoes", "views", "impressions"]],
  ["engagement", ["engajamento", "contas engajadas", "engagement"]],
  ["profileVisits", ["visitas ao perfil", "visitas", "visitas no perfil", "profile visits"]],
  ["interactions", ["interacoes", "interactions"]],
  ["likes", ["curtidas", "likes"]],
  ["comments", ["comentarios", "comments"]],
  ["saves", ["salvos", "salvamentos", "saves"]],
  ["shares", ["compartilhamentos", "shares"]],
  ["linkClicks", ["toques em links", "toque em links", "toques no site", "toque no site", "toques no link", "cliques no link", "cliques no site", "link clicks"]],
];

/** Métricas cujo nome varia entre as abas: o rótulo da planilha é mantido no portal. */
const KEEP_LABEL: ReadonlySet<SocialMetricKey> = new Set(["views", "linkClicks"]);

/** Taxas e médias são calculadas pelo portal — nunca lidas como contagem. */
const RATE = /\b(taxa|media|percentual|rate|crescimento)\b/;

const MONTH_NAMES: Record<string, number> = Object.fromEntries([
  ...MONTHS_PT.map((m, i) => [normalizeText(m), i + 1]),
  ...MONTHS_SHORT_PT.map((m, i) => [m, i + 1]),
]);

/** Palavras que não identificam um cliente ("Dra. Isabor" ≈ "ISABOR SANTANNA"). */
const STOPWORDS = new Set(["da", "de", "do", "das", "dos", "e", "dr", "dra", "drs", "dras"]);

/** Abas de apoio (modelo, instruções): nunca são a aba do cliente. */
const IGNORED_SHEET = /^(instrucoes|leia me|leiame|readme|como usar|glossario|legenda)\b/;

/** Nomes de aba que não dizem de quem é (aba única exportada, tabela colada). */
const GENERIC_SHEET = /^(planilha|sheet|pagina|aba|dados|tabela|rede social|redes sociais|social|instagram|facebook|tiktok|linkedin|youtube|analise|relatorio|metricas)\b|^\d+$/;

export interface SocialNormalizeContext {
  requestedPeriod: Period | null;
  /** Nome, nome curto e slug do cliente — para achar a aba dele. */
  clientNames: string[];
  /** Hoje (AAAA-MM-DD): define o ano quando a planilha só tem o nome dos meses. */
  today: string;
}

export interface SocialNormalizeResult {
  periods: ParsedPeriod[];
  sheets: Array<{ name: string; rows: number; recognizedAs: string | null }>;
}

const tokens = (s: string) => normalizeText(s).split(" ").filter((t) => t && !STOPWORDS.has(t));
const subset = (a: string[], b: string[]) => a.length > 0 && a.every((t) => b.includes(t));

export type SheetMatch = { kind: "match"; name: string } | { kind: "ambiguous"; names: string[] } | { kind: "none" };

/**
 * Aba do cliente pelo nome: igual ao nome, nome curto ou slug (sem acento, caixa e
 * "Dra."); senão, a única aba cujas palavras estão todas no nome do cliente (ou o contrário).
 */
export function matchClientSheet(sheetNames: readonly string[], clientNames: readonly string[]): SheetMatch {
  const targets = [...new Set(clientNames.map((n) => tokens(n.replace(/-/g, " "))).filter((t) => t.length).map((t) => t.join(" ")))].map((t) => t.split(" "));
  const sheets = sheetNames.map((name) => ({ name, t: tokens(name) })).filter((s) => s.t.length);
  const compact = (t: string[]) => t.join("");
  const exact = sheets.filter((s) => targets.some((t) => compact(t) === compact(s.t) || (subset(t, s.t) && subset(s.t, t))));
  if (exact.length) return { kind: "match", name: exact[0].name };
  const partial = sheets.filter((s) => targets.some((t) => subset(s.t, t) || subset(t, s.t)));
  if (partial.length === 1) return { kind: "match", name: partial[0].name };
  if (partial.length > 1) return { kind: "ambiguous", names: partial.map((s) => s.name) };
  return { kind: "none" };
}

/** Para o readExcel: lê só a aba do cliente quando ela é encontrada (a planilha da Look tem dezenas de abas). */
export function selectClientSheet(clientNames: readonly string[]) {
  return (names: string[]): string[] => {
    const m = matchClientSheet(names, clientNames);
    return m.kind === "match" ? [m.name] : names;
  };
}

interface Columns {
  period: string | null;
  metrics: Array<[SocialMetricKey, string]>;
  extras: string[];
}

function resolveColumns(sheet: RawSheet): Columns {
  const h = sheet.headers;
  const rates = h.filter((c) => RATE.test(normalizeText(c)) || c.includes("%"));
  let period = findColumn(h, PERIOD, rates);
  // Sem cabeçalho "Mês": a 1ª coluna, se ela tiver meses.
  if (!period && h[0] && sheet.rows.filter((r) => parseMonth(r.cells[h[0]]) !== null).length >= 1) period = h[0];
  const used: Array<string | null> = [period, ...rates];
  const metrics: Array<[SocialMetricKey, string]> = [];
  for (const [key, aliases] of COLUMN_ALIASES) {
    const col = findColumn(h, aliases, used);
    if (col) {
      metrics.push([key, col]);
      used.push(col);
    }
  }
  // Outras colunas com números (ex.: "Publicações", "Stories") aparecem como vieram.
  const extras = h.filter((c) => !used.includes(c) && !/^coluna \d+$/i.test(c) && sheet.rows.some((r) => isMonthRow(r, period) && numberCell(r.cells[c]).value !== null));
  return { period, metrics, extras };
}

function isMonthRow(row: RawSheet["rows"][number], periodCol: string | null): boolean {
  return periodCol ? parseMonth(row.cells[periodCol]) !== null : true;
}

const isSocialSheet = (sheet: RawSheet) => resolveColumns(sheet).metrics.length > 0;

/** "JANEIRO", "jan", "Março" → mês sem ano; "01/2026", "jan/26", datas → mês e ano. */
function parseMonth(v: CellValue | undefined): { month: number; year: number | null } | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 12) return { month: v, year: null };
  const full = monthCell(v);
  if (full) return { month: full.month, year: full.year };
  if (typeof v !== "string") return null;
  const n = normalizeText(v);
  return MONTH_NAMES[n] ? { month: MONTH_NAMES[n], year: null } : null;
}

/** "TOQUES EM LINKS" → "Toques em links" (cabeçalhos em caixa alta viram frase). */
export function humanizeLabel(header: string): string {
  const s = header.replace(/\s+/g, " ").replace(/:$/, "").trim();
  if (s.length <= 4 || s !== s.toUpperCase()) return s;
  const lower = s.toLocaleLowerCase("pt-BR");
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

function detectNetwork(text: string): SocialNetwork {
  const n = normalizeText(text);
  if (/\binstagram\b|\binsta\b/.test(n)) return "instagram";
  if (/\bfacebook\b/.test(n)) return "facebook";
  if (/\btik ?tok\b/.test(n)) return "tiktok";
  if (/\blinkedin\b/.test(n)) return "linkedin";
  if (/\byoutube\b/.test(n)) return "youtube";
  return "instagram";
}

function pickSheet(workbook: RawWorkbook, ctx: SocialNormalizeContext, issues: IssueCollector): RawSheet | null {
  const client = ctx.clientNames[0] ?? "o cliente";
  const candidates = workbook.sheets.filter((s) => !IGNORED_SHEET.test(normalizeText(s.name)) && isSocialSheet(s));
  const allNames = workbook.sheetNames ?? workbook.sheets.map((s) => s.name);
  if (!candidates.length) {
    issues.error(
      "missing_column",
      `Não encontramos as colunas da análise de rede social${workbook.sheets.length === 1 ? ` na aba ${workbook.sheets[0].name}` : ""}. A tabela precisa da coluna Mês e de métricas como Seguidores, Novos seguidores, Alcance, Visualizações (ou Impressões), Engajamento e Interações. Confira o formato esperado ou baixe o modelo.`,
    );
    return null;
  }
  if (candidates.length === 1) {
    // Aba única (exportada sozinha ou colada): vale, mas avisa se o nome for de outro cliente.
    const sheet = candidates[0];
    if (matchClientSheet([sheet.name], ctx.clientNames).kind === "none" && !GENERIC_SHEET.test(normalizeText(sheet.name))) {
      issues.warn("sheet_name_mismatch", `A aba se chama ${sheet.name.trim()}, que não parece ser de ${client}. Confira se é a planilha deste cliente antes de publicar.`, { sheet: sheet.name });
    }
    return sheet;
  }
  const match = matchClientSheet(candidates.map((s) => s.name), ctx.clientNames);
  if (match.kind === "match") return candidates.find((s) => s.name === match.name) ?? null;
  const list = (names: readonly string[]) => `${names.slice(0, 15).map((n) => n.trim()).join(", ")}${names.length > 15 ? ` e mais ${names.length - 15}` : ""}`;
  if (match.kind === "ambiguous") {
    issues.error("ambiguous_sheet", `Mais de uma aba parece ser de ${client}: ${list(match.names)}. Deixe a aba com o nome do cliente como está no portal (“${client}”) ou envie uma planilha só com a aba dele.`);
  } else {
    issues.error("client_sheet_not_found", `A planilha não tem uma aba com o nome de ${client}. Abas encontradas: ${list(allNames)}. Renomeie a aba do cliente para “${client}” (como está no portal) ou envie uma planilha só com a aba dele.`);
  }
  return null;
}

interface MonthRow {
  line: number;
  month: number;
  year: number | null;
  metrics: Partial<SocialMetrics>;
  extras: SocialExtraMetric[];
}

export function normalizeSocial(workbook: RawWorkbook, ctx: SocialNormalizeContext, issues: IssueCollector): SocialNormalizeResult {
  const sheet = pickSheet(workbook, ctx, issues);
  if (!sheet) return { periods: [], sheets: workbook.sheets.length <= 3 ? workbook.sheets.map((s) => ({ name: s.name, rows: s.rows.length, recognizedAs: null })) : [] };

  const cols = resolveColumns(sheet);
  const title = [...(sheet.preamble ?? []), sheet.name].join(" ");
  const network = detectNetwork(title);
  const sheets = [{ name: sheet.name.trim(), rows: sheet.rows.length, recognizedAs: `Rede social · ${NETWORK_LABEL[network]}` }];
  const where = (line?: number, column?: string) => ({ sheet: sheet.name, ...(line ? { row: line } : {}), ...(column ? { column } : {}) });

  const rows: MonthRow[] = [];
  for (const row of sheet.rows) {
    const rawLabel = cols.period ? row.cells[cols.period] : null;
    const label = textCell(rawLabel ?? null);
    const values = cols.metrics.map(([key, col]) => ({ key, col, cell: numberCell(row.cells[col]) }));
    const extras = cols.extras.map((col) => ({ col, cell: numberCell(row.cells[col]) }));
    const hasNumber = [...values, ...extras].some((v) => v.cell.value !== null);
    const month = cols.period ? parseMonth(rawLabel) : ctx.requestedPeriod ? { month: +ctx.requestedPeriod.start.slice(5, 7), year: +ctx.requestedPeriod.start.slice(0, 4) } : null;

    if (!month) {
      if (label && /^observa/.test(normalizeText(label))) {
        const note = Object.entries(row.cells)
          .filter(([c]) => c !== cols.period)
          .map(([, v]) => textCell(v))
          .filter(Boolean)
          .join(" ")
          .trim();
        if (note) issues.warn("sheet_note", `Observação da planilha (não aparece para o cliente): “${note.slice(0, 280)}”.`, where(row.line));
        continue;
      }
      // Glossário, títulos e linhas sem números ficam de fora; linha com números e mês ilegível é erro.
      if (!hasNumber || isTotalLabel(label)) continue;
      if (!cols.period) {
        issues.error("missing_period", `A aba ${sheet.name} não tem a coluna Mês. Inclua a coluna Mês (Janeiro, 01/2026…) ou escolha o mês no passo Período.`, where());
        break;
      }
      issues.error("invalid_period", `O mês “${describeCell(rawLabel ?? null)}” (aba ${sheet.name}, linha ${row.line}) não foi reconhecido. Use o nome do mês (Janeiro) ou mês/ano (01/2026).`, where(row.line, cols.period));
      continue;
    }
    // Mês ainda sem números (o resto do ano na planilha).
    if (!hasNumber) continue;

    const metrics: Partial<SocialMetrics> = {};
    let invalid = false;
    for (const { key, col, cell } of values) {
      if (cell.invalid) {
        issues.error("invalid_number", `O valor “${describeCell(row.cells[col])}” em ${humanizeLabel(col)} (aba ${sheet.name}, linha ${row.line}) não é um número.`, where(row.line, col));
        invalid = true;
        continue;
      }
      let value = cell.value;
      if (value !== null && value < 0) {
        // "Perdas" às vezes vem com sinal (−36): é a mesma contagem.
        if (key === "lostFollowers") value = Math.abs(value);
        else {
          issues.error("invalid_number", `${humanizeLabel(col)} não pode ser negativo (aba ${sheet.name}, linha ${row.line}).`, where(row.line, col));
          invalid = true;
          continue;
        }
      }
      metrics[key] = value;
    }
    if (invalid) continue;
    rows.push({
      line: row.line,
      month: month.month,
      year: month.year,
      metrics,
      extras: extras.map(({ col, cell }) => ({ key: slugify(col) || `coluna-${cols.extras.indexOf(col) + 1}`, label: humanizeLabel(col).slice(0, 80), value: cell.invalid ? null : cell.value })),
    });
  }

  // Ano: o do mês (01/2026), o do título ("… - 2024"), o do mês escolhido no assistente ou, por último, o ano corrente.
  const [todayYear, todayMonth] = ctx.today.split("-").map(Number);
  const yearIn = (text: string) => [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => +m[1]).find((y) => y >= 2010 && y <= todayYear + 1) ?? null;
  const titleYear = yearIn((sheet.preamble ?? []).join(" ")) ?? yearIn(sheet.name);
  let fallbackYear = titleYear ?? (ctx.requestedPeriod ? +ctx.requestedPeriod.start.slice(0, 4) : null);
  const monthOnly = rows.filter((r) => r.year === null);
  if (fallbackYear === null && monthOnly.length) {
    // Meses depois do mês atual ainda não aconteceram: a planilha é do ano passado.
    const latest = Math.max(...monthOnly.map((r) => r.month));
    fallbackYear = latest > todayMonth ? todayYear - 1 : todayYear;
    if (fallbackYear !== todayYear) {
      issues.warn("year_assumed", `A planilha não informa o ano e tem meses depois de ${MONTHS_PT[todayMonth - 1]}: os meses foram lidos como ${fallbackYear}. Se não for esse ano, escreva o ano no título da aba (ex.: “ANÁLISE DE DADOS - INSTAGRAM - ${todayYear}”).`, where());
    }
  }

  const byKey = new Map<string, { period: Period; row: MonthRow }>();
  for (const r of rows) {
    const period = monthPeriod(r.year ?? fallbackYear ?? todayYear, r.month);
    const key = periodKey(period);
    const dup = byKey.get(key);
    if (dup) {
      issues.error("duplicate_period", `${formatPeriod(period)} aparece duas vezes na aba ${sheet.name} (linhas ${dup.row.line} e ${r.line}). Deixe uma linha por mês.`, where(r.line));
      continue;
    }
    byKey.set(key, { period, row: r });
  }

  const labels: Record<string, string> = {};
  for (const [key, col] of cols.metrics) if (KEEP_LABEL.has(key)) labels[key] = humanizeLabel(col).slice(0, 80);

  const periods: ParsedPeriod[] = [...byKey.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, { period, row }]) => {
      const data: SocialDataInput = { schemaVersion: 1, period, network, metrics: row.metrics, labels, extraMetrics: row.extras };
      warnMonth(data, sheet.name, issues);
      return { periodKey: key, period, sections: ["all"], data, insights: [] };
    });
  return { periods, sheets };
}

/** Avisos que não impedem a importação. */
function warnMonth(data: SocialDataInput, sheet: string, issues: IssueCollector) {
  const m = data.metrics;
  const label = formatPeriod(data.period);
  if (typeof m.engagement === "number" && typeof m.reach === "number" && m.engagement > m.reach) {
    issues.warn("engagement_above_reach", `Em ${label}, o engajamento (${m.engagement}) é maior que o alcance (${m.reach}). Confira os valores na aba ${sheet}.`, { sheet });
  }
  if (typeof m.likes === "number" && typeof m.interactions === "number" && m.likes > m.interactions) {
    issues.warn("likes_above_interactions", `Em ${label}, as curtidas (${m.likes}) passam do total de interações (${m.interactions}). Confira os valores na aba ${sheet}.`, { sheet });
  }
}
