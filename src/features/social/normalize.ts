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
 *
 * Anos anteriores: uma aba por ano ("LUCAS FRAGA 2025", ou só "2025" num arquivo do
 * cliente), vários blocos na mesma aba (cada um com o título e o ano acima) ou um
 * arquivo por ano ("… 2025.xlsx"). Todos os meses de todos os anos entram juntos.
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
const STOPWORDS = new Set(["da", "de", "do", "das", "dos", "e", "dr", "dra", "drs", "dras", "ano"]);

/** Ano no nome da aba ("LUCAS FRAGA 2025"): diz o período, não o cliente. */
const YEAR_TOKEN = /^(19|20)\d{2}$/;

/** Abas de apoio (modelo, instruções): nunca são a aba do cliente. */
const IGNORED_SHEET = /^(instrucoes|leia me|leiame|readme|como usar|glossario|legenda)\b/;

/** Nomes de aba que não dizem de quem é (aba única exportada, tabela colada, "Instagram 2025"). */
const GENERIC_SHEET = /^(planilha|sheet|pagina|aba|dados|tabela|rede social|redes sociais|social|instagram|facebook|tiktok|linkedin|youtube|analise|relatorio|metricas)(\d+)?( |$)/;

/** Linha de título de um bloco ("ANÁLISE DE DADOS - INSTAGRAM - 2025"): o ano dela vale para os meses abaixo. */
const TITLE_WORDS = /\b(analise|dados|instagram|facebook|tiktok|linkedin|youtube|relatorio|rede social)\b/;

export interface SocialNormalizeContext {
  requestedPeriod: Period | null;
  /** Nome, nome curto e slug do cliente — para achar a aba dele. */
  clientNames: string[];
  /** Hoje (AAAA-MM-DD): define o ano quando a planilha só tem o nome dos meses. */
  today: string;
  /** Nome do arquivo: "… 2025.xlsx" diz o ano das abas que não dizem. */
  fileName?: string | null;
}

export interface SocialNormalizeResult {
  periods: ParsedPeriod[];
  sheets: Array<{ name: string; rows: number; recognizedAs: string | null }>;
}

/** Palavras do nome que identificam o cliente — sem acento, "Dra.", "de" e sem o ano. */
const nameTokens = (s: string) =>
  normalizeText(s)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t) && !YEAR_TOKEN.test(t));
const subset = (a: string[], b: string[]) => a.length > 0 && a.every((t) => b.includes(t));
const isGenericSheet = (name: string) => {
  const t = nameTokens(name);
  return !t.length || GENERIC_SHEET.test(t.join(" "));
};

/** `names`: todas as abas do cliente (uma por ano, quando há anos anteriores). */
export type SheetMatch = { kind: "match"; names: string[] } | { kind: "ambiguous"; names: string[] } | { kind: "none" };

/**
 * Abas do cliente pelo nome: iguais ao nome, nome curto ou slug (sem acento, caixa,
 * "Dra." e ano); senão, as abas cujas palavras estão todas no nome do cliente (ou o
 * contrário) — desde que sejam do mesmo nome ("ISABOR SANTANNA" e "ISABOR SANTANNA 2025").
 */
export function matchClientSheet(sheetNames: readonly string[], clientNames: readonly string[]): SheetMatch {
  const targets = [...new Set(clientNames.map((n) => nameTokens(n.replace(/-/g, " "))).filter((t) => t.length).map((t) => t.join(" ")))].map((t) => t.split(" "));
  const sheets = sheetNames.map((name) => ({ name, t: nameTokens(name) })).filter((s) => s.t.length);
  const compact = (t: string[]) => t.join("");
  const exact = sheets.filter((s) => targets.some((t) => compact(t) === compact(s.t) || (subset(t, s.t) && subset(s.t, t))));
  if (exact.length) return { kind: "match", names: exact.map((s) => s.name) };
  const partial = sheets.filter((s) => targets.some((t) => subset(s.t, t) || subset(t, s.t)));
  const distinct = new Set(partial.map((s) => compact(s.t)));
  if (distinct.size === 1) return { kind: "match", names: partial.map((s) => s.name) };
  if (distinct.size > 1) return { kind: "ambiguous", names: partial.map((s) => s.name) };
  return { kind: "none" };
}

/** Para o readExcel: lê só as abas do cliente quando são encontradas (a planilha da Look tem dezenas de abas). */
export function selectClientSheet(clientNames: readonly string[]) {
  return (names: string[]): string[] => {
    const m = matchClientSheet(names, clientNames);
    return m.kind === "match" ? m.names : names;
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

/** Abas a ler: as do cliente (uma ou mais, por ano) ou, num arquivo só dele, todas as abas de dados. */
function pickSheets(workbook: RawWorkbook, ctx: SocialNormalizeContext, issues: IssueCollector): RawSheet[] {
  const client = ctx.clientNames[0] ?? "o cliente";
  const candidates = workbook.sheets.filter((s) => !IGNORED_SHEET.test(normalizeText(s.name)) && isSocialSheet(s));
  const allNames = workbook.sheetNames ?? workbook.sheets.map((s) => s.name);
  if (!candidates.length) {
    issues.error(
      "missing_column",
      `Não encontramos as colunas da análise de rede social${workbook.sheets.length === 1 ? ` na aba ${workbook.sheets[0].name}` : ""}. A tabela precisa da coluna Mês e de métricas como Seguidores, Novos seguidores, Alcance, Visualizações (ou Impressões), Engajamento e Interações. Confira o formato esperado ou baixe o modelo.`,
    );
    return [];
  }
  if (candidates.length === 1) {
    // Aba única (exportada sozinha ou colada): vale, mas avisa se o nome for de outro cliente.
    const sheet = candidates[0];
    if (matchClientSheet([sheet.name], ctx.clientNames).kind === "none" && !isGenericSheet(sheet.name)) {
      issues.warn("sheet_name_mismatch", `A aba se chama ${sheet.name.trim()}, que não parece ser de ${client}. Confira se é a planilha deste cliente antes de publicar.`, { sheet: sheet.name });
    }
    return candidates;
  }
  const match = matchClientSheet(candidates.map((s) => s.name), ctx.clientNames);
  if (match.kind === "match") return candidates.filter((s) => match.names.includes(s.name));
  // Arquivo de um cliente só, com uma aba por ano ("2025", "2026", "Instagram 2024"): lê todas.
  if (match.kind === "none" && candidates.every((s) => isGenericSheet(s.name))) return candidates;
  const list = (names: readonly string[]) => `${names.slice(0, 15).map((n) => n.trim()).join(", ")}${names.length > 15 ? ` e mais ${names.length - 15}` : ""}`;
  if (match.kind === "ambiguous") {
    issues.error("ambiguous_sheet", `Mais de uma aba parece ser de ${client}: ${list(match.names)}. Deixe a aba com o nome do cliente como está no portal (“${client}”) ou envie uma planilha só com a aba dele.`);
  } else {
    issues.error("client_sheet_not_found", `A planilha não tem uma aba com o nome de ${client}. Abas encontradas: ${list(allNames)}. Renomeie a aba do cliente para “${client}” (como está no portal) ou envie uma planilha só com a aba dele.`);
  }
  return [];
}

interface MonthRow {
  sheet: string;
  line: number;
  month: number;
  year: number | null;
  network: SocialNetwork;
  labels: Record<string, string>;
  metrics: Partial<SocialMetrics>;
  extras: SocialExtraMetric[];
}

export function normalizeSocial(workbook: RawWorkbook, ctx: SocialNormalizeContext, issues: IssueCollector): SocialNormalizeResult {
  const picked = pickSheets(workbook, ctx, issues);
  if (!picked.length) return { periods: [], sheets: workbook.sheets.length <= 3 ? workbook.sheets.map((s) => ({ name: s.name, rows: s.rows.length, recognizedAs: null })) : [] };

  const [todayYear, todayMonth] = ctx.today.split("-").map(Number);
  // Só anos plausíveis: "Clínica 1990" ou um telefone não viram ano.
  const yearIn = (text: string) => [...text.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => +m[1]).find((y) => y >= 2010 && y <= todayYear + 1) ?? null;
  const fileYear = ctx.fileName ? yearIn(ctx.fileName.replace(/\.[a-z0-9]+$/i, "")) : null;

  const rows: MonthRow[] = [];
  const sheetNetworks = new Map<string, SocialNetwork>();
  for (const sheet of picked) {
    const read = readSheet(sheet, ctx, yearIn, fileYear, issues);
    rows.push(...read.rows);
    sheetNetworks.set(sheet.name, read.network);
  }

  // Meses ainda sem ano: deduzido pelos próprios meses (meses depois do atual são do ano passado).
  // O mês do assistente vem preenchido com o pendente, então só vale quando aponta para um ano anterior (escolha deliberada).
  const undated = rows.filter((r) => r.year === null);
  if (undated.length) {
    const latest = Math.max(...undated.map((r) => r.month));
    const inferred = latest > todayMonth ? todayYear - 1 : todayYear;
    const requestedYear = ctx.requestedPeriod ? +ctx.requestedPeriod.start.slice(0, 4) : null;
    const year = requestedYear !== null && requestedYear < inferred ? requestedYear : inferred;
    for (const r of undated) r.year = year;
    if (year !== todayYear) {
      issues.warn("year_assumed", `A planilha não informa o ano: os meses foram lidos como ${year}. Se não for esse ano, escreva o ano no título da aba (ex.: “ANÁLISE DE DADOS - INSTAGRAM - ${year}”), no nome da aba ou no nome do arquivo.`, { sheet: undated[0].sheet });
    }
  }

  const byKey = new Map<string, { period: Period; row: MonthRow }>();
  for (const r of rows) {
    const period = monthPeriod(r.year!, r.month);
    const key = periodKey(period);
    const dup = byKey.get(key);
    if (dup) {
      const where = dup.row.sheet === r.sheet ? `na aba ${r.sheet} (linhas ${dup.row.line} e ${r.line})` : `nas abas ${dup.row.sheet.trim()} (linha ${dup.row.line}) e ${r.sheet.trim()} (linha ${r.line})`;
      issues.error("duplicate_period", `${formatPeriod(period)} aparece duas vezes ${where}. Deixe uma linha por mês — se forem anos diferentes, coloque o ano no título de cada bloco ou no nome de cada aba.`, { sheet: r.sheet, row: r.line });
      continue;
    }
    byKey.set(key, { period, row: r });
  }

  const periods: ParsedPeriod[] = [...byKey.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, { period, row }]) => {
      const data: SocialDataInput = { schemaVersion: 1, period, network: row.network, metrics: row.metrics, labels: row.labels, extraMetrics: row.extras };
      warnMonth(data, row.sheet, issues);
      return { periodKey: key, period, sections: ["all"], data, insights: [] };
    });

  const sheets = picked.map((s) => {
    const years = [...new Set([...byKey.values()].filter((v) => v.row.sheet === s.name).map((v) => v.period.start.slice(0, 4)))].sort();
    return { name: s.name.trim(), rows: s.rows.length, recognizedAs: `Rede social · ${NETWORK_LABEL[sheetNetworks.get(s.name) ?? "instagram"]}${years.length ? ` · ${years.join(", ")}` : ""}` };
  });
  return { periods, sheets };
}

/** Linhas de mês de uma aba, com o ano do título/nome da aba/arquivo ou do bloco em que estão. */
function readSheet(sheet: RawSheet, ctx: SocialNormalizeContext, yearIn: (text: string) => number | null, fileYear: number | null, issues: IssueCollector): { rows: MonthRow[]; network: SocialNetwork } {
  const cols = resolveColumns(sheet);
  const network = detectNetwork([...(sheet.preamble ?? []), sheet.name].join(" "));
  const where = (line?: number, column?: string) => ({ sheet: sheet.name, ...(line ? { row: line } : {}), ...(column ? { column } : {}) });
  const labels: Record<string, string> = {};
  for (const [key, col] of cols.metrics) if (KEEP_LABEL.has(key)) labels[key] = humanizeLabel(col).slice(0, 80);

  let blockYear = yearIn((sheet.preamble ?? []).join(" ")) ?? yearIn(sheet.name) ?? fileYear;
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
      if (!hasNumber) {
        // Título de um novo bloco ("ANÁLISE DE DADOS - INSTAGRAM - 2025" ou só "2025"): o ano vale para os meses abaixo.
        const marker = blockYearOf(row, yearIn);
        if (marker !== null) blockYear = marker;
        continue;
      }
      // Glossário e títulos ficam de fora; linha com números e mês ilegível é erro.
      if (isTotalLabel(label)) continue;
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
      sheet: sheet.name,
      line: row.line,
      month: month.month,
      year: month.year ?? blockYear,
      network,
      labels,
      metrics,
      extras: extras.map(({ col, cell }) => ({ key: slugify(col) || `coluna-${cols.extras.indexOf(col) + 1}`, label: humanizeLabel(col).slice(0, 80), value: cell.invalid ? null : cell.value })),
    });
  }
  return { rows, network };
}

/** Ano de uma linha de título de bloco: uma célula só com o ano, ou um título da análise com o ano. */
function blockYearOf(row: RawSheet["rows"][number], yearIn: (text: string) => number | null): number | null {
  for (const value of Object.values(row.cells)) {
    const text = textCell(value);
    if (!text) continue;
    if (/^\s*(19|20)\d{2}\s*$/.test(text)) {
      const year = yearIn(text);
      if (year !== null) return year;
    } else if (TITLE_WORDS.test(normalizeText(text))) {
      const year = yearIn(text);
      if (year !== null) return year;
    }
  }
  return null;
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
