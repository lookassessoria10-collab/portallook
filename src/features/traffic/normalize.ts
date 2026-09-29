import { formatCurrency, formatPercent } from "@/lib/format/number";
import { normalizeText, slugify } from "@/lib/ids";
import { formatPeriod, periodKey, type Period } from "@/lib/dates/period";
import { dateCell, findColumn, numberCell, percentCell, textCell } from "@/lib/parsers/cells";
import type { RawSheet, RawWorkbook } from "@/lib/parsers/types";
import type { IssueCollector } from "@/features/uploads/issues";
import { resolveRangePeriod, type PeriodContext } from "@/features/uploads/row-period";
import type { ParsedInsight, ParsedPeriod } from "@/features/uploads/parsed";
import { mapInsightType } from "@/features/uploads/insight-type";
import { safeDivide } from "@/lib/metrics/safe-math";
import type { ResultType, TrafficDataInput } from "./schema";

const CAMPAIGN_SHEETS = ["campanhas", "campanha", "trafego", "midia", "anuncios", "campaigns", "ads", "meta ads", "google ads"];
const INSIGHT_SHEETS = ["insights", "analise", "observacoes", "comentarios"];

export function mapPlatform(value: string | null): string | null {
  if (!value) return null;
  const n = normalizeText(value);
  if (/meta|facebook|instagram|fb\b|ig\b/.test(n)) return "meta_ads";
  if (/youtube/.test(n)) return "youtube_ads";
  if (/google|adwords|gads/.test(n)) return "google_ads";
  if (/tiktok/.test(n)) return "tiktok_ads";
  if (/linkedin/.test(n)) return "linkedin_ads";
  return value.trim().slice(0, 40);
}

export function mapResultType(value: string | null): { type: ResultType; label: string | null } {
  if (!value) return { type: "other", label: null };
  const n = normalizeText(value);
  if (/whats|conversa|mensage|messag|direct/.test(n)) return { type: "whatsapp", label: null };
  if (/formul|form\b/.test(n)) return { type: "form", label: null };
  if (/lead|cadastr/.test(n)) return { type: "lead", label: null };
  if (/compra|purchase|venda/.test(n)) return { type: "purchase", label: null };
  if (/agend|appoint|consulta/.test(n)) return { type: "appointment", label: null };
  if (/liga|chamad|call|telefon/.test(n)) return { type: "call", label: null };
  if (/convers/.test(n)) return { type: "conversion", label: null };
  if (/visit|landing|pagina|view/.test(n)) return { type: "visit", label: null };
  return { type: "other", label: value.trim().slice(0, 60) };
}

function matchSheet(name: string, aliases: string[]) {
  const n = normalizeText(name);
  return aliases.some((a) => n === a || n.startsWith(`${a} `));
}

export interface TrafficNormalizeResult {
  periods: ParsedPeriod[];
  sheets: Array<{ name: string; rows: number; recognizedAs: string | null }>;
}

type Campaign = TrafficDataInput["campaigns"][number];

export function normalizeTraffic(workbook: RawWorkbook, ctx: PeriodContext & { clientNames: string[]; csv?: boolean }, issues: IssueCollector): TrafficNormalizeResult {
  const sheets: TrafficNormalizeResult["sheets"] = [];
  let campaignSheets = workbook.sheets.filter((s) => ctx.csv || matchSheet(s.name, CAMPAIGN_SHEETS));
  if (!campaignSheets.length) {
    const candidates = workbook.sheets.filter((s) => !matchSheet(s.name, INSIGHT_SHEETS) && s.rows.length);
    if (candidates.length === 1) campaignSheets = candidates;
  }
  const insightSheets = ctx.csv ? [] : workbook.sheets.filter((s) => matchSheet(s.name, INSIGHT_SHEETS));
  for (const s of workbook.sheets) {
    sheets.push({ name: s.name, rows: s.rows.length, recognizedAs: campaignSheets.includes(s) ? "Campanhas" : insightSheets.includes(s) ? "Insights" : null });
  }
  if (!campaignSheets.length) {
    issues.error("missing_sheet", 'A aba "Campanhas" não foi encontrada. Baixe o modelo de tráfego para ver o formato esperado.');
    return { periods: [], sheets };
  }

  const byPeriod = new Map<string, { period: Period; campaigns: Campaign[]; insights: ParsedInsight[] }>();
  for (const sheet of campaignSheets) readCampaigns(sheet, ctx, issues, byPeriod);
  for (const sheet of insightSheets) readTrafficInsights(sheet, byPeriod, ctx);

  const periods: ParsedPeriod[] = [];
  for (const [key, entry] of [...byPeriod.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!entry.campaigns.length) continue;
    const data: TrafficDataInput = { schemaVersion: 1, period: entry.period, campaigns: entry.campaigns };
    periods.push({ periodKey: key, period: entry.period, sections: ["campaigns"], data, insights: entry.insights });
  }
  if (!periods.length && !issues.hasErrors) issues.error("empty", "Nenhuma campanha com dados foi encontrada no arquivo.");
  return { periods, sheets };
}

function readCampaigns(sheet: RawSheet, ctx: PeriodContext & { clientNames: string[] }, issues: IssueCollector, byPeriod: Map<string, { period: Period; campaigns: Campaign[]; insights: ParsedInsight[] }>) {
  const h = sheet.headers;
  const clientCol = findColumn(h, ["cliente", "client", "anunciante", "conta"]);
  const startCol = findColumn(h, ["inicio", "data inicial", "data de inicio", "start", "start date", "data inicio"]);
  const endCol = findColumn(h, ["fim", "termino", "data final", "data de termino", "end", "end date", "data fim"], [startCol]);
  const rangeCol = startCol || endCol ? null : findColumn(h, ["periodo", "semana", "period"]);
  const platformCol = findColumn(h, ["plataforma", "platform", "rede", "veiculo", "canal"]);
  const nameCol = findColumn(h, ["campanha", "nome da campanha", "campaign", "campaign name"], [platformCol]);
  const objectiveCol = findColumn(h, ["objetivo", "objective"]);
  const investCol = findColumn(h, ["investimento", "valor investido", "valor gasto", "valor usado", "gasto", "custo total", "amount spent", "spend"]);
  const impCol = findColumn(h, ["impressoes", "impressions"]);
  const reachCol = findColumn(h, ["alcance", "reach"]);
  const linkCol = findColumn(h, ["cliques no link", "link clicks", "cliques em link"]);
  const clicksCol = findColumn(h, ["cliques", "clicks", "cliques todos"], [linkCol]);
  const typeCol = findColumn(h, ["tipo de resultado", "tipo resultado", "result type", "indicador de resultado"]);
  const cprCol = findColumn(h, ["custo por resultado", "cost per result", "cpr"]);
  const resultsCol = findColumn(h, ["resultados", "results", "resultado"], [typeCol, cprCol]);
  const convCol = findColumn(h, ["conversoes", "conversions"]);
  const revenueCol = findColumn(h, ["receita atribuida", "receita", "valor de conversao", "conversion value", "faturamento"]);
  const ctrCol = findColumn(h, ["ctr"]);

  const required: Array<[string | null, string]> = [
    [nameCol, "Campanha"],
    [platformCol, "Plataforma"],
    [investCol, "Investimento"],
    [impCol, "Impressões"],
  ];
  const missing = required.filter(([c]) => !c).map(([, l]) => l);
  if (missing.length) {
    for (const col of missing) issues.error("missing_column", `A coluna ${col} não foi encontrada na aba ${sheet.name}.`, { sheet: sheet.name, column: col });
    return;
  }

  const clientNames = ctx.clientNames.map(normalizeText).filter(Boolean);
  const usedIds = new Map<string, Set<string>>();

  for (const row of sheet.rows) {
    const where = { sheet: sheet.name, row: row.line };
    const name = textCell(row.cells[nameCol!]);
    if (!name) continue;

    if (clientCol) {
      const c = textCell(row.cells[clientCol]);
      if (c && clientNames.length && !clientNames.some((n) => normalizeText(c).includes(n) || n.includes(normalizeText(c)))) {
        issues.error("client_mismatch", `A linha ${row.line} da aba ${sheet.name} é do cliente "${c}", que não corresponde ao cliente selecionado.`, { ...where, column: clientCol });
        continue;
      }
    }

    let start = startCol ? dateCell(row.cells[startCol]) : null;
    let end = endCol ? dateCell(row.cells[endCol]) : null;
    if (rangeCol) {
      const text = textCell(row.cells[rangeCol]) ?? "";
      const m = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\s*(?:a|até|ate|-|–)\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i.exec(text);
      if (m) {
        start = dateCell(m[1]);
        end = dateCell(m[2]);
      }
    }
    if ((startCol && row.cells[startCol] && !start) || (endCol && row.cells[endCol] && !end)) {
      issues.error("invalid_period", `A data de início ou fim na linha ${row.line} (aba ${sheet.name}) não é uma data válida.`, where);
      continue;
    }
    const period = resolveRangePeriod(start, end, ctx, issues, { sheet: sheet.name, line: row.line });
    if (!period) continue;

    const num = (col: string | null, label: string) => {
      if (!col) return null;
      const n = numberCell(row.cells[col]);
      if (n.invalid) issues.error("invalid_number", `O valor de ${label} da campanha "${name}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { ...where, column: col });
      return n.value === null ? null : Math.max(0, n.value);
    };
    const investment = num(investCol, "Investimento");
    const impressions = num(impCol, "Impressões");
    if (investment === null || impressions === null) {
      issues.error("missing_value", `A campanha "${name}" (linha ${row.line}) precisa de Investimento e Impressões.`, where);
      continue;
    }
    const platform = mapPlatform(textCell(row.cells[platformCol!]));
    if (!platform) {
      issues.error("missing_value", `Informe a plataforma da campanha "${name}" (aba ${sheet.name}, linha ${row.line}).`, where);
      continue;
    }
    const results = num(resultsCol, "Resultados");
    const typeText = typeCol ? textCell(row.cells[typeCol]) : null;
    const rt = typeText ? mapResultType(typeText) : results !== null ? mapResultType(resultsCol) : { type: null, label: null };
    if (results !== null && !typeText && rt.type === "other") issues.warn("missing_result_type", `A campanha "${name}" tem resultados, mas o tipo de resultado não foi informado.`, where);

    const key = periodKey(period);
    let entry = byPeriod.get(key);
    if (!entry) {
      entry = { period, campaigns: [], insights: [] };
      byPeriod.set(key, entry);
    }
    const ids = usedIds.get(key) ?? new Set<string>();
    let id = slugify(`${platform}-${name}`) || `campanha-${row.line}`;
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);
    usedIds.set(key, ids);

    const campaign: Campaign = {
      id,
      platform,
      name,
      objective: objectiveCol ? textCell(row.cells[objectiveCol]) : null,
      investment,
      impressions,
      reach: num(reachCol, "Alcance"),
      clicks: num(clicksCol, "Cliques"),
      linkClicks: num(linkCol, "Cliques no link"),
      results,
      resultType: rt.type,
      resultLabel: rt.label,
      conversions: num(convCol, "Conversões"),
      attributedRevenue: num(revenueCol, "Receita atribuída"),
    };
    entry.campaigns.push(campaign);
    warnCampaign(campaign, row.cells, { cprCol, ctrCol }, formatPeriod(period), issues, where);
  }
}

function warnCampaign(c: Campaign, cells: RawSheet["rows"][number]["cells"], cols: { cprCol: string | null; ctrCol: string | null }, label: string, issues: IssueCollector, where: { sheet: string; row: number }) {
  if (c.reach == null && c.platform === "meta_ads") issues.warn("missing_reach", `A campanha "${c.name}" (${label}) não tem alcance informado.`, where);
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

function readTrafficInsights(sheet: RawSheet, byPeriod: Map<string, { period: Period; campaigns: Campaign[]; insights: ParsedInsight[] }>, ctx: PeriodContext) {
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
