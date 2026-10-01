import { formatCurrency, formatPercent } from "@/lib/format/number";
import { normalizeText, slugify } from "@/lib/ids";
import { diffDays, formatPeriod, monthPeriod, periodKey, weekPeriod, type Period } from "@/lib/dates/period";
import { dateCell, findColumn, monthCell, numberCell, percentCell, textCell, type NumberCell } from "@/lib/parsers/cells";
import type { CellValue, RawSheet, RawWorkbook } from "@/lib/parsers/types";
import type { IssueCollector } from "@/features/uploads/issues";
import { isTotalLabel, resolveRangePeriod, type PeriodContext } from "@/features/uploads/row-period";
import type { ParsedInsight, ParsedPeriod } from "@/features/uploads/parsed";
import { mapInsightType } from "@/features/uploads/insight-type";
import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";
import { PLATFORM_ORDER, platformLabel, type ResultType, type TrafficDataInput } from "./schema";

const CAMPAIGN_SHEETS = ["campanhas", "campanha", "trafego", "midia", "anuncios", "campaigns", "ads", "meta ads", "google ads"];
const INSIGHT_SHEETS = ["insights", "analise", "observacoes", "comentarios"];

const INVESTMENT = ["investimento", "valor investido", "valor gasto", "valor usado", "gasto", "custo total", "amount spent", "spend", "verba", "custo", "cost"];
const IMPRESSIONS = ["impressoes", "impressions", "impr"];
/** Cabeçalhos genéricos de resultado: sem a coluna "Tipo de resultado", o tipo fica indefinido. */
const GENERIC_RESULTS = new Set(["resultados", "results", "resultado"]);

/** Nomes aceitos (para a mensagem de coluna ausente). */
const ACCEPTED: Record<string, string> = {
  Plataforma: "Plataforma, Rede, Veículo (ou escolha a plataforma no assistente)",
  Investimento: "Investimento, Valor investido, Valor gasto, Valor usado, Gasto, Verba, Custo, Spend",
  Impressões: "Impressões, Impr., Impressions",
};

/**
 * Colunas derivadas (taxas, custos unitários, frequência): nunca podem ser lidas
 * como contagem ou investimento — "CTR (taxa de cliques no link)" não é "Cliques",
 * "Custo/conv." não é "Custo".
 */
const DERIVED = /^(ctr|taxa|cpc|cpm|cpa|cpr|cpl|roas|custo por|custo med|custo conv|cost per|frequencia|frequency|percentual|porcentagem|ranking|indice)\b/;

function derivedColumns(headers: string[]): string[] {
  return headers.filter((h) => DERIVED.test(normalizeText(h)) || h.includes("%"));
}

/** Família de plataforma: YouTube é comprado pelo Google Ads; Audience Network/Messenger são do Meta. */
const PLATFORM_FAMILY: Record<string, string> = { meta_ads: "meta_ads", google_ads: "google_ads", youtube_ads: "google_ads", tiktok_ads: "tiktok_ads", linkedin_ads: "linkedin_ads" };

export function mapPlatform(value: string | null): string | null {
  if (!value) return null;
  const n = normalizeText(value);
  if (/meta|facebook|instagram|fb\b|ig\b|audience network|messenger|threads/.test(n)) return "meta_ads";
  if (/youtube/.test(n)) return "youtube_ads";
  if (/google|adwords|gads/.test(n)) return "google_ads";
  if (/tiktok/.test(n)) return "tiktok_ads";
  if (/linkedin/.test(n)) return "linkedin_ads";
  return value.trim().slice(0, 40);
}

/**
 * Tipo de resultado a partir do texto ("Conversas no WhatsApp", "Leads") ou do
 * indicador do Meta ("actions:onsite_conversion.messaging_conversation_started_7d").
 * `type: null` = a métrica não é um resultado (alcance, cliques, visualizações): não entra em Resultados.
 */
export function mapResultType(value: string | null): { type: ResultType | null; label: string | null } {
  if (!value) return { type: "other", label: null };
  const n = normalizeText(value).replace(/^(actions?|onsite conversion|offsite conversion) /, "");
  if (/whats|conversa|conversation|mensage|messag|direct/.test(n)) return { type: "whatsapp", label: null };
  if (/formul|form\b/.test(n)) return { type: "form", label: null };
  if (/lead|cadastr|complete registration/.test(n)) return { type: "lead", label: null };
  if (/compra|purchase|venda/.test(n)) return { type: "purchase", label: null };
  if (/agend|appoint|schedule|consulta/.test(n)) return { type: "appointment", label: null };
  if (/liga|chamad|\bcall|telefon/.test(n)) return { type: "call", label: null };
  if (/^(reach|alcance|impress)|link click|clique|video|thruplay|visualizac|engagement|engajamento|\blike|curtida|seguidor|follow|frequencia/.test(n)) return { type: null, label: null };
  if (/convers/.test(n)) return { type: "conversion", label: null };
  if (/visit|landing|pagina|perfil|profile/.test(n)) return { type: "visit", label: null };
  // Código técnico ("actions:xyz") nunca vira rótulo para o cliente.
  const code = /[_:.]/.test(value) && !/\s/.test(value.trim());
  return { type: "other", label: code ? null : value.trim().slice(0, 60) };
}

function matchSheet(name: string, aliases: string[]) {
  const n = normalizeText(name);
  return aliases.some((a) => n === a || n.startsWith(`${a} `));
}

/** Coluna pelo nome exato (sem buscar por trecho: "conta" não pode casar com "Contatos"). */
function exactColumn(headers: string[], aliases: string[]): string | null {
  const al = aliases.map(normalizeText);
  return headers.find((h) => al.includes(normalizeText(h))) ?? null;
}

/** Contagens (impressões, cliques, alcance) nunca têm decimais: "12,345" é doze mil (exportação em inglês). */
function countCell(v: CellValue): NumberCell {
  if (typeof v === "string" && /^\s*\d{1,3}(,\d{3})+\s*$/.test(v)) return { value: Number(v.replace(/[,\s]/g, "")), invalid: false };
  return numberCell(v);
}

export interface TrafficNormalizeResult {
  periods: ParsedPeriod[];
  sheets: Array<{ name: string; rows: number; recognizedAs: string | null }>;
}

type Campaign = TrafficDataInput["campaigns"][number];
type PeriodAcc = Map<string, { period: Period; campaigns: Campaign[]; insights: ParsedInsight[] }>;

export interface TrafficNormalizeContext extends PeriodContext {
  clientNames: string[];
  csv?: boolean;
  /** Arquivo de uma plataforma só: dispensa a coluna Plataforma e ignora linhas de outras plataformas. */
  platform?: string | null;
  /** Moeda do cliente: avisa quando o arquivo traz outra ("Valor usado (USD)"). */
  currency?: string;
}

export function normalizeTraffic(workbook: RawWorkbook, ctx: TrafficNormalizeContext, issues: IssueCollector): TrafficNormalizeResult {
  const sheets: TrafficNormalizeResult["sheets"] = [];
  let campaignSheets = workbook.sheets.filter((s) => ctx.csv || matchSheet(s.name, CAMPAIGN_SHEETS));
  if (!campaignSheets.length) {
    // Sem aba "Campanhas": usa as abas que têm colunas de investimento e impressões
    // (exportações do Meta/Google, tabelas coladas com outro título).
    const candidates = workbook.sheets.filter((s) => !matchSheet(s.name, INSIGHT_SHEETS) && s.rows.length);
    const withData = candidates.filter((s) => findColumn(s.headers, INVESTMENT, derivedColumns(s.headers)) && findColumn(s.headers, IMPRESSIONS, derivedColumns(s.headers)));
    // Duas abas com os mesmos números (ex.: "Resumo" e "Detalhamento") seriam somadas em dobro:
    // com várias, ficam só as que têm coluna de campanha; sem isso, só é aceita uma aba.
    const withCampaigns = withData.filter((s) => findColumn(s.headers, ["campanha", "nome da campanha", "campaign", "campaign name"]));
    if (withData.length > 1 && withCampaigns.length) {
      campaignSheets = withCampaigns;
      const skipped = withData.filter((s) => !withCampaigns.includes(s));
      if (skipped.length) issues.warn("sheet_ignored", `${skipped.length === 1 ? "A aba" : "As abas"} ${skipped.map((s) => `"${s.name}"`).join(", ")} não ${skipped.length === 1 ? "tem" : "têm"} coluna de campanha e ${skipped.length === 1 ? "foi ignorada" : "foram ignoradas"} para não somar os mesmos números duas vezes.`);
    } else if (withData.length > 1) {
      issues.error("ambiguous_sheets", `O arquivo tem ${withData.length} abas com investimento e impressões (${withData.map((s) => `"${s.name}"`).join(", ")}). Renomeie para "Campanhas" a aba que deve ser importada, ou deixe só uma.`);
      return { periods: [], sheets: workbook.sheets.map((s) => ({ name: s.name, rows: s.rows.length, recognizedAs: null })) };
    } else {
      campaignSheets = withData.length ? withData : candidates.length === 1 ? candidates : [];
    }
  }
  const insightSheets = ctx.csv ? [] : workbook.sheets.filter((s) => matchSheet(s.name, INSIGHT_SHEETS));
  for (const s of workbook.sheets) {
    sheets.push({ name: s.name, rows: s.rows.length, recognizedAs: campaignSheets.includes(s) ? "Campanhas" : insightSheets.includes(s) ? "Insights" : null });
  }
  if (!campaignSheets.length) {
    issues.error("missing_sheet", 'A aba "Campanhas" não foi encontrada. Baixe o modelo de tráfego para ver o formato esperado.');
    return { periods: [], sheets };
  }

  const byPeriod: PeriodAcc = new Map();
  for (const sheet of campaignSheets) readCampaigns(sheet, ctx, issues, byPeriod);
  for (const sheet of insightSheets) readTrafficInsights(sheet, byPeriod, ctx);

  const periods: ParsedPeriod[] = [];
  for (const [key, entry] of [...byPeriod.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!entry.campaigns.length) continue;
    const data: TrafficDataInput = { schemaVersion: 1, period: entry.period, currency: ctx.currency ?? "BRL", campaigns: entry.campaigns };
    periods.push({ periodKey: key, period: entry.period, sections: ["campaigns"], data, insights: entry.insights });
  }
  if (!periods.length && !issues.hasErrors) issues.error("empty", "Nenhuma campanha com dados foi encontrada no arquivo.");
  return { periods, sheets };
}

/** Linha de totais das exportações ("Total: conta", "Total geral"): não é campanha. */
function isTotalRow(cells: Record<string, CellValue>, headers: string[], nameCol: string | null): boolean {
  return isTotalLabel(headers.map((h) => textCell(cells[h])).find((v) => v !== null)) || (nameCol !== null && isTotalLabel(textCell(cells[nameCol])));
}

/** Tipo da coluna única de período, pelo nome: "Mês" é mês, "Semana" é semana, "Data"/"Dia" é dia. */
type PeriodColumnKind = "month" | "week" | "day" | "any";

function periodColumnKind(header: string): PeriodColumnKind {
  const n = normalizeText(header);
  if (/^(mes|month|competencia)/.test(n)) return "month";
  if (/^(semana|week)/.test(n)) return "week";
  if (/^(data|dia|date|day)/.test(n)) return "day";
  return "any";
}

/** Período bruto de uma coluna única: "01/01/2026 a 31/01/2026", "jan/2026", "2026-01-01"… */
function cellPeriod(value: CellValue | undefined, kind: PeriodColumnKind, ctx: PeriodContext, issues: IssueCollector, where: { sheet: string; line: number; column: string }): Period | null {
  const text = textCell(value ?? null) ?? "";
  const range = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\s*(?:a|até|ate|-|–)\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i.exec(text);
  if (range) return resolveRangePeriod(dateCell(range[1]), dateCell(range[2]), ctx, issues, where);
  if (value === null || value === undefined || text === "") return resolveRangePeriod(null, null, ctx, issues, where);
  const day = kind === "month" ? null : dateCell(value);
  if (day) {
    if (kind === "week" || (kind === "any" && ctx.granularity === "week")) return weekPeriod(day);
    return { start: day, end: day, granularity: "custom" };
  }
  const month = kind === "week" || kind === "day" ? null : monthCell(value);
  if (month) return monthPeriod(month.year, month.month);
  issues.error("invalid_period", `O período "${text.slice(0, 40)}" na aba ${where.sheet}, linha ${where.line}, não é válido. Use, por exemplo, ${ctx.granularity === "week" ? '"21/09/2026 a 27/09/2026"' : '"01/2026" ou "janeiro de 2026"'}.`, {
    sheet: where.sheet,
    row: where.line,
    column: where.column,
  });
  return null;
}

/**
 * Encaixa o período da linha na periodicidade do cliente — o portal nunca mistura
 * semanas e meses. Dias e semanas dentro de um mês viram o mês (e são somados);
 * dias dentro de uma semana viram a semana. O que não cabe volta como problema.
 */
function fitToCadence(period: Period, ctx: PeriodContext): Period | { problem: string } {
  const sameMonth = period.start.slice(0, 7) === period.end.slice(0, 7);
  if (ctx.granularity === "month") {
    if (period.granularity === "month") return period;
    if (sameMonth) return monthPeriod(+period.start.slice(0, 4), +period.start.slice(5, 7));
    return { problem: `cobre ${formatPeriod(period)}, mais de um mês` };
  }
  if (period.granularity === "week") return period;
  if (period.granularity === "month") return { problem: `é do mês inteiro (${formatPeriod(period)})` };
  const days = diffDays(period.end, period.start) + 1;
  const week = weekPeriod(period.start);
  if (period.end <= week.end) return week;
  // Semanas que não começam na segunda (ex.: domingo a sábado) seguem como período próprio.
  if (days <= 7) return period;
  return { problem: `cobre ${formatPeriod(period)}, mais de uma semana` };
}

/** Soma dois valores opcionais (null + null = null). */
function add(a: number | null | undefined, b: number | null | undefined): number | null {
  return sumMaybe([a, b]);
}

/** Mesma campanha em várias linhas do mesmo período (por dia, por conjunto de anúncios…): soma. */
function mergeCampaign(into: Campaign, c: Campaign): boolean {
  if (into.resultType && c.resultType && into.resultType !== c.resultType) return false;
  into.investment += c.investment;
  into.impressions += c.impressions;
  // Alcance não soma (as mesmas pessoas aparecem em vários dias): fica sem alcance.
  into.reach = null;
  into.clicks = add(into.clicks, c.clicks);
  into.linkClicks = add(into.linkClicks, c.linkClicks);
  into.results = add(into.results, c.results);
  into.resultType = into.resultType ?? c.resultType;
  into.resultLabel = into.resultLabel ?? c.resultLabel;
  into.conversions = add(into.conversions, c.conversions);
  into.attributedRevenue = add(into.attributedRevenue, c.attributedRevenue);
  return true;
}

function readCampaigns(sheet: RawSheet, ctx: TrafficNormalizeContext, issues: IssueCollector, byPeriod: PeriodAcc) {
  const h = sheet.headers;
  const derived = derivedColumns(h);
  const clientCol = findColumn(h, ["cliente", "client", "anunciante"], derived);
  const accountCol = clientCol ? null : exactColumn(h, ["nome da conta", "nome da conta de anuncios", "conta", "conta de anuncios", "account name", "account"]);
  // Exportação do Meta: "Início/Término dos relatórios" são o período; "Início/Término" sozinhos são a agenda da campanha.
  const startCol = findColumn(h, ["inicio dos relatorios", "reporting starts"]) ?? findColumn(h, ["inicio", "data inicial", "data de inicio", "start", "start date", "data inicio"]);
  const endCol = findColumn(h, ["termino dos relatorios", "reporting ends"]) ?? findColumn(h, ["fim", "termino", "data final", "data de termino", "end", "end date", "data fim"], [startCol]);
  const periodCol = startCol || endCol ? null : findColumn(h, ["periodo", "semana", "period", "mes", "month", "competencia", "mes de referencia", "data", "dia", "date", "day", "week"]);
  const platformCol = findColumn(h, ["plataforma", "platform", "rede", "veiculo", "canal"], derived);
  const nameCol = findColumn(h, ["campanha", "nome da campanha", "campaign", "campaign name"], [platformCol, ...derived]);
  const objectiveCol = findColumn(h, ["objetivo", "objective"]);
  const investCol = findColumn(h, INVESTMENT, derived);
  const impCol = findColumn(h, IMPRESSIONS, derived);
  const reachCol = findColumn(h, ["alcance", "reach"], derived);
  const linkCol = findColumn(h, ["cliques no link", "link clicks", "cliques em link"], derived);
  const clicksCol = findColumn(h, ["cliques", "clicks", "cliques todos"], [linkCol, ...derived]);
  const typeCol = findColumn(h, ["tipo de resultado", "tipo resultado", "result type", "indicador de resultado"]);
  const cprCol = findColumn(h, ["custo por resultado", "cost per result", "cpr"]);
  const resultsCol = findColumn(h, ["resultados", "results", "resultado", "contatos", "conversas", "conversas iniciadas", "mensagens", "leads"], [typeCol, cprCol, ...derived]);
  const convCol = findColumn(h, ["conversoes", "conversions"], derived);
  const revenueCol = findColumn(h, ["receita atribuida", "receita", "valor de conversao", "conversion value", "faturamento"], derived);
  const ctrCol = findColumn(h, ["ctr"]);

  const required: Array<[string | null, string]> = [
    [investCol, "Investimento"],
    [impCol, "Impressões"],
  ];
  // Com a plataforma escolhida no upload, a coluna Plataforma é dispensada.
  if (!ctx.platform) required.unshift([platformCol, "Plataforma"]);
  const missing = required.filter(([c]) => !c).map(([, l]) => l);
  if (missing.length) {
    const read = h.filter((x) => !/^Coluna \d+$/.test(x)).slice(0, 12).join(", ");
    for (const col of missing) {
      issues.error("missing_column", `A coluna ${col} não foi encontrada na aba ${sheet.name}. Nomes aceitos: ${ACCEPTED[col]}.${read ? ` Colunas lidas: ${read}.` : ""}`, { sheet: sheet.name, column: col });
    }
    return;
  }

  const currencyInHeader = /\(([A-Z]{3})\)/.exec(investCol!)?.[1];
  if (currencyInHeader && ctx.currency && currencyInHeader !== ctx.currency) {
    issues.warn("currency_mismatch", `A coluna "${investCol}" está em ${currencyInHeader}, mas o cliente usa ${ctx.currency}. Os valores serão exibidos em ${ctx.currency} sem conversão.`, { sheet: sheet.name, column: investCol! });
  }

  const clientNames = ctx.clientNames.map(normalizeText).filter(Boolean);
  const belongs = (value: string) => !clientNames.length || clientNames.some((n) => normalizeText(value).includes(n) || n.includes(normalizeText(value)));
  const usedIds = new Map<string, Set<string>>();
  const cadenceProblems: string[] = [];
  let otherPlatformRows = 0;
  let missingReach = 0;
  let mergedRows = 0;
  let nonResultRows = 0;
  let accountWarned = false;
  const forcedFamily = ctx.platform ? (PLATFORM_FAMILY[ctx.platform] ?? ctx.platform) : null;

  for (const row of sheet.rows) {
    const where = { sheet: sheet.name, row: row.line };
    if (isTotalRow(row.cells, h, nameCol)) continue;
    const named = nameCol ? textCell(row.cells[nameCol]) : null;
    if (nameCol && !named) continue;

    if (clientCol) {
      const c = textCell(row.cells[clientCol]);
      if (c && !belongs(c)) {
        issues.error("client_mismatch", `A linha ${row.line} da aba ${sheet.name} é do cliente "${c}", que não corresponde ao cliente selecionado.`, { ...where, column: clientCol });
        continue;
      }
    }
    if (accountCol && !accountWarned) {
      // Nome de conta de anúncios costuma ser diferente do nome do cliente: só avisa.
      const a = textCell(row.cells[accountCol]);
      if (a && !belongs(a)) {
        issues.warn("account_mismatch", `A conta de anúncios "${a.slice(0, 60)}" não parece ser deste cliente. Confira se o arquivo é do cliente certo.`, { ...where, column: accountCol });
        accountWarned = true;
      }
    }

    const rowPlatform = platformCol ? mapPlatform(textCell(row.cells[platformCol])) : null;
    if (forcedFamily && rowPlatform && PLATFORM_ORDER.includes(rowPlatform) && rowPlatform !== "other" && (PLATFORM_FAMILY[rowPlatform] ?? rowPlatform) !== forcedFamily) {
      // Só descarta plataformas conhecidas e diferentes ("Google Ads" num upload do Meta);
      // valores como "Pesquisa", "Display" ou "audience_network" pertencem à plataforma escolhida.
      otherPlatformRows++;
      continue;
    }
    const platform = ctx.platform ?? rowPlatform;
    if (!platform) {
      issues.error("missing_value", `Informe a plataforma da campanha "${named ?? `linha ${row.line}`}" (aba ${sheet.name}, linha ${row.line}).`, where);
      continue;
    }
    const name = named ?? platformLabel(platform);

    let raw: Period | null;
    if (periodCol) {
      raw = cellPeriod(row.cells[periodCol], periodColumnKind(periodCol), ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    } else {
      const start = startCol ? dateCell(row.cells[startCol]) : null;
      const end = endCol ? dateCell(row.cells[endCol]) : null;
      if ((startCol && row.cells[startCol] && !start) || (endCol && row.cells[endCol] && !end)) {
        issues.error("invalid_period", `A data de início ou fim na linha ${row.line} (aba ${sheet.name}) não é uma data válida.`, where);
        continue;
      }
      raw = resolveRangePeriod(start, end, ctx, issues, { sheet: sheet.name, line: row.line });
    }
    if (!raw) continue;
    const fitted = fitToCadence(raw, ctx);
    if ("problem" in fitted) {
      cadenceProblems.push(`linha ${row.line} ${fitted.problem}`);
      continue;
    }
    const period = fitted;

    const invalid = new Set<string>();
    const read = (col: string | null, label: string, parse: (v: CellValue) => NumberCell = numberCell) => {
      if (!col) return null;
      const n = parse(row.cells[col]);
      if (n.invalid) {
        invalid.add(col);
        issues.error("invalid_number", `O valor de ${label} da campanha "${name}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { ...where, column: col });
      }
      return n.value === null ? null : Math.max(0, n.value);
    };
    const investment = read(investCol, "Investimento");
    const impressions = read(impCol, "Impressões", countCell);
    if (investment === null || impressions === null) {
      if (!invalid.size) issues.error("missing_value", `A campanha "${name}" (linha ${row.line}) precisa de Investimento e Impressões.`, where);
      continue;
    }

    // Sem coluna (ou valor) de resultados, as conversões (Google Ads) são o resultado da campanha.
    const conversions = read(convCol, "Conversões");
    const typeText = typeCol ? textCell(row.cells[typeCol]) : null;
    let results = resultsCol ? read(resultsCol, "Resultados") : null;
    let resultSource = resultsCol;
    if (results === null && conversions !== null && !typeText) {
      results = conversions;
      resultSource = convCol;
    }
    const generic = resultSource ? GENERIC_RESULTS.has(normalizeText(resultSource)) : true;
    let rt: { type: ResultType | null; label: string | null } = typeText ? mapResultType(typeText) : results !== null && !generic ? mapResultType(resultSource) : { type: results !== null ? "other" : null, label: null };
    if (results !== null && rt.type === null) {
      // Alcance, cliques e visualizações não são resultado (não somam com conversas e leads).
      nonResultRows++;
      results = null;
      rt = { type: null, label: null };
    }
    if (results !== null && !typeText && generic) issues.warn("missing_result_type", `A campanha "${name}" tem resultados, mas o tipo de resultado não foi informado.`, where);

    const key = periodKey(period);
    let entry = byPeriod.get(key);
    if (!entry) {
      entry = { period, campaigns: [], insights: [] };
      byPeriod.set(key, entry);
    }

    const campaign: Campaign = {
      id: "",
      platform,
      name,
      objective: objectiveCol ? textCell(row.cells[objectiveCol]) : null,
      investment,
      impressions,
      reach: read(reachCol, "Alcance", countCell),
      clicks: read(clicksCol, "Cliques", countCell),
      linkClicks: read(linkCol, "Cliques no link", countCell),
      results,
      resultType: rt.type,
      resultLabel: rt.label,
      conversions,
      attributedRevenue: read(revenueCol, "Receita atribuída"),
    };
    warnCampaign(campaign, row.cells, { cprCol, ctrCol }, formatPeriod(period), issues, where);
    if (campaign.reach == null && platform === "meta_ads") missingReach++;

    const same = entry.campaigns.find((c) => c.platform === platform && c.name === name && (!c.resultType || !campaign.resultType || c.resultType === campaign.resultType));
    if (same && mergeCampaign(same, campaign)) {
      mergedRows++;
      continue;
    }

    const ids = usedIds.get(key) ?? new Set<string>();
    let id = slugify(`${platform}-${name}`) || `campanha-${row.line}`;
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);
    usedIds.set(key, ids);
    entry.campaigns.push({ ...campaign, id });
  }

  if (cadenceProblems.length) {
    const expected = ctx.granularity === "month" ? "mensais" : "semanais";
    const how = ctx.granularity === "month" ? "divisão por mês (Meta Ads: Divisão › Por tempo › Mês; Google Ads: segmentar por Mês)" : "divisão por semana (Meta Ads: Divisão › Por tempo › Semana; Google Ads: segmentar por Semana)";
    issues.error(
      "period_cadence",
      `Este cliente recebe relatórios de tráfego ${expected}, mas ${cadenceProblems.length === 1 ? "uma linha" : `${cadenceProblems.length} linhas`} não ${cadenceProblems.length === 1 ? "cabe" : "cabem"} nesse formato (${cadenceProblems.slice(0, 3).join("; ")}${cadenceProblems.length > 3 ? "; …" : ""}). Exporte com ${how}${ctx.granularity === "week" ? " ou mude a periodicidade do tráfego no cadastro do cliente" : ""}.`,
      { sheet: sheet.name },
    );
  }
  if (mergedRows) {
    issues.warn("rows_merged", `${mergedRows} linha(s) repetiam a mesma campanha no mesmo período e foram somadas. O alcance dessas campanhas não é somado e fica sem informação.`, { sheet: sheet.name });
  }
  if (nonResultRows) {
    issues.warn("non_result_metric", `${nonResultRows} linha(s) têm como resultado alcance, cliques ou visualizações. Esses números não entram como resultado no portal (continuam em Alcance e Cliques).`, { sheet: sheet.name });
  }
  if (missingReach) {
    issues.warn("missing_reach", missingReach === 1 ? "Uma campanha do Meta Ads está sem alcance informado." : `${missingReach} linhas do Meta Ads estão sem alcance informado.`, { sheet: sheet.name });
  }
  if (otherPlatformRows) {
    issues.warn("other_platform_rows", `${otherPlatformRows} linha(s) de outras plataformas foram ignoradas: este upload é só de ${platformLabel(ctx.platform!)}.`, { sheet: sheet.name });
  }
}

function warnCampaign(c: Campaign, cells: RawSheet["rows"][number]["cells"], cols: { cprCol: string | null; ctrCol: string | null }, label: string, issues: IssueCollector, where: { sheet: string; row: number }) {
  if (c.investment === 0) issues.warn("zero_investment", `A campanha "${c.name}" está com investimento zero em ${label}.`, where);
  // Os indicadores são recalculados pelo sistema; divergência grande indica erro de digitação.
  if (cols.cprCol) {
    const informed = numberCell(cells[cols.cprCol]).value;
    const computed = safeDivide(c.investment, c.results ?? null);
    if (informed !== null && computed !== null && Math.abs(informed - computed) > Math.max(0.05, computed * 0.03)) {
      issues.warn("cpr_mismatch", `O custo por resultado informado para "${c.name}" (${formatCurrency(informed)}) difere do calculado (${formatCurrency(computed)}). O portal usa o valor calculado.`, where);
    }
  }
  if (cols.ctrCol) {
    const informed = percentCell(cells[cols.ctrCol]).value;
    const clicks = c.clicks ?? c.linkClicks ?? null;
    const computed = safeDivide(clicks, c.impressions);
    if (informed !== null && computed !== null && Math.abs(informed - computed) > 0.002) {
      issues.warn("ctr_mismatch", `O CTR informado para "${c.name}" (${formatPercent(informed, 2)}) difere do calculado (${formatPercent(computed, 2)}). O portal usa o valor calculado.`, where);
    }
  }
}

function readTrafficInsights(sheet: RawSheet, byPeriod: PeriodAcc, ctx: PeriodContext) {
  const h = sheet.headers;
  const titleCol = findColumn(h, ["titulo", "title", "destaque"]);
  if (!titleCol) return;
  const descCol = findColumn(h, ["descricao", "texto", "description", "detalhe"], [titleCol]);
  const typeCol = findColumn(h, ["tipo", "categoria", "type"], [titleCol, descCol]);
  const startCol = findColumn(h, ["inicio", "semana", "periodo", "data"]);
  const periods = [...byPeriod.values()];
  for (const row of sheet.rows) {
    const title = textCell(row.cells[titleCol]);
    if (!title) continue;
    const start = startCol ? dateCell(row.cells[startCol]) : null;
    const target = (start ? periods.find((p) => p.period.start <= start && start <= p.period.end) : null) ?? (ctx.requestedPeriod ? byPeriod.get(periodKey(ctx.requestedPeriod)) : null) ?? periods.at(-1);
    target?.insights.push({ type: mapInsightType(typeCol ? textCell(row.cells[typeCol]) : null), title: title.slice(0, 140), description: (descCol ? (textCell(row.cells[descCol]) ?? "") : "").slice(0, 1500) });
  }
}

