import { formatInteger } from "@/lib/format/number";
import { normalizeText, slugify } from "@/lib/ids";
import { formatPeriod, periodKey, type Period } from "@/lib/dates/period";
import { findColumn, numberCell, textCell } from "@/lib/parsers/cells";
import type { RawSheet, RawWorkbook } from "@/lib/parsers/types";
import type { IssueCollector } from "@/features/uploads/issues";
import { resolveRowPeriod, type PeriodContext } from "@/features/uploads/row-period";
import type { CommercialSection, ParsedInsight, ParsedPeriod } from "@/features/uploads/parsed";
import { mapInsightType } from "@/features/uploads/insight-type";
import type { ChannelKind, CommercialDataInput } from "./schema";

/**
 * Planilha (qualquer layout razoável) → modelo comercial padronizado.
 * Os componentes visuais nunca veem a planilha: só o CommercialData.
 */
export type SheetRole = "funnel" | "financial" | "channels" | "dimension" | "dimensions" | "extraMetrics" | "insights" | "context";

const ROLE_ALIASES: Array<[SheetRole, string[]]> = [
  ["funnel", ["funil", "funnel", "etapas", "pipeline"]],
  ["financial", ["financeiro", "financial", "financas", "faturamento"]],
  ["channels", ["canais", "canal", "origem", "origens", "channels", "origem dos leads"]],
  ["dimensions", ["dimensoes", "dimensions", "detalhamento"]],
  ["extraMetrics", ["indicadores", "kpis", "metricas", "indicadores adicionais"]],
  ["insights", ["insights", "analise", "analises", "observacoes", "comentarios"]],
  ["context", ["contexto", "context", "avisos"]],
];

const IGNORED_SHEETS = ["instrucoes", "leia me", "leiame", "readme", "como usar", "exemplo", "modelo", "config"];

export function classifySheet(name: string): SheetRole | "ignored" {
  const n = normalizeText(name);
  if (IGNORED_SHEETS.some((a) => n === a || n.startsWith(`${a} `))) return "ignored";
  for (const [role, aliases] of ROLE_ALIASES) if (aliases.some((a) => n === a || n.startsWith(`${a} `))) return role;
  return "dimension";
}

const PERIOD = ["periodo", "mes", "mes de referencia", "competencia", "referencia", "period", "month", "data"];

interface Acc {
  period: Period;
  funnel: Map<string, { label: string; order: number; value: number | null }>;
  financial: NonNullable<CommercialDataInput["financial"]> | null;
  channels: NonNullable<CommercialDataInput["channels"]>;
  dimensions: Map<string, { label: string; quantityLabel: string | null; rows: NonNullable<CommercialDataInput["dimensions"]>[number]["rows"] }>;
  extraMetrics: NonNullable<CommercialDataInput["extraMetrics"]>;
  context: CommercialDataInput["context"];
  insights: ParsedInsight[];
  sections: Set<CommercialSection>;
}

export interface CommercialNormalizeResult {
  periods: ParsedPeriod[];
  sheets: Array<{ name: string; rows: number; recognizedAs: string | null }>;
}

const ROLE_LABEL: Record<SheetRole, string> = {
  funnel: "Funil",
  financial: "Financeiro",
  channels: "Canais",
  dimension: "Dimensão",
  dimensions: "Dimensões",
  extraMetrics: "Indicadores",
  insights: "Insights",
  context: "Contexto",
};

export function normalizeCommercial(
  workbook: RawWorkbook,
  ctx: PeriodContext & { csvRole?: SheetRole; csvDimensionLabel?: string | null },
  issues: IssueCollector,
): CommercialNormalizeResult {
  const accs = new Map<string, Acc>();
  const acc = (p: Period): Acc => {
    const key = periodKey(p);
    let a = accs.get(key);
    if (!a) {
      a = { period: p, funnel: new Map(), financial: null, channels: [], dimensions: new Map(), extraMetrics: [], context: null, insights: [], sections: new Set() };
      accs.set(key, a);
    }
    return a;
  };

  const sheets: CommercialNormalizeResult["sheets"] = [];
  for (const sheet of workbook.sheets) {
    const role = ctx.csvRole ?? classifySheet(sheet.name);
    if (role === "ignored" || sheet.rows.length === 0) {
      sheets.push({ name: sheet.name, rows: sheet.rows.length, recognizedAs: null });
      continue;
    }
    sheets.push({ name: sheet.name, rows: sheet.rows.length, recognizedAs: role === "dimension" ? `Dimensão: ${ctx.csvDimensionLabel ?? sheet.name}` : ROLE_LABEL[role] });
    const handlers: Record<SheetRole, () => void> = {
      funnel: () => readFunnel(sheet, ctx, issues, acc),
      financial: () => readFinancial(sheet, ctx, issues, acc),
      channels: () => readChannels(sheet, ctx, issues, acc),
      dimension: () => readDimension(sheet, ctx.csvDimensionLabel ?? sheet.name, ctx, issues, acc),
      dimensions: () => readDimensionsLong(sheet, ctx, issues, acc),
      extraMetrics: () => readExtraMetrics(sheet, ctx, issues, acc),
      insights: () => readInsights(sheet, ctx, issues, acc),
      context: () => readContext(sheet, ctx, issues, acc),
    };
    handlers[role]();
  }

  const partial = Boolean(ctx.csvRole);
  if (!partial && !workbook.sheets.some((s) => classifySheet(s.name) === "funnel")) {
    issues.error("missing_sheet", 'A aba "Funil" não foi encontrada. Ela é obrigatória para o relatório comercial (baixe o modelo para ver o formato).');
  }

  const periods: ParsedPeriod[] = [];
  for (const [key, a] of [...accs.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const label = formatPeriod(a.period);
    const funnel = [...a.funnel.entries()].map(([k, s]) => ({ key: k, label: s.label, order: s.order, value: s.value })).sort((x, y) => x.order - y.order);
    if (!partial && !funnel.length) {
      issues.error("missing_funnel", `A aba Funil não tem dados para ${label}, mas outras abas têm. Inclua o funil desse período ou remova as linhas dele.`);
      continue;
    }
    const data: CommercialDataInput = {
      schemaVersion: 1,
      period: a.period,
      funnel,
      financial: a.financial,
      channels: a.channels,
      dimensions: [...a.dimensions.entries()].filter(([, d]) => d.rows.length).map(([k, d]) => ({ key: k, label: d.label, quantityLabel: d.quantityLabel, rows: d.rows })),
      extraMetrics: a.extraMetrics,
      context: a.context,
    };
    warnCommercial(data, label, issues, partial);
    periods.push({ periodKey: key, period: a.period, sections: [...a.sections], data, insights: a.insights });
  }
  return { periods, sheets };
}

function readFunnel(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const stageCol = findColumn(h, ["etapa", "fase", "stage", "estagio"]);
  if (stageCol) {
    const orderCol = findColumn(h, ["ordem", "order", "posicao"]);
    const qtyCol = findColumn(h, ["quantidade", "qtd", "valor", "total", "quantity", "volume"], [periodCol, stageCol, orderCol]);
    if (!qtyCol) return issues.error("missing_column", 'A coluna "Quantidade" não foi encontrada na aba Funil.', { sheet: sheet.name, column: "Quantidade" });
    const autoOrder = new Map<string, number>();
    for (const row of sheet.rows) {
      const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
      const label = textCell(row.cells[stageCol]);
      if (!period || !label) {
        if (!label && period) issues.error("missing_value", `A etapa do funil precisa ser preenchida (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line });
        continue;
      }
      const key = slugify(label) || `etapa-${row.line}`;
      if (!autoOrder.has(key)) autoOrder.set(key, autoOrder.size + 1);
      const order = orderCol ? numberCell(row.cells[orderCol]).value : null;
      const qty = numberCell(row.cells[qtyCol]);
      if (qty.invalid) issues.error("invalid_number", `A quantidade da etapa "${label}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: qtyCol });
      const a = acc(period);
      a.funnel.set(key, { label, order: order ?? autoOrder.get(key)!, value: qty.value === null ? null : Math.max(0, qty.value) });
      a.sections.add("funnel");
    }
    return;
  }
  // Formato "largo": Período | Leads | Agendamentos | Comparecimentos …
  // Colunas de texto ("Observações", "Responsável"…) não viram etapas; uma coluna única
  // com valores inválidos continua sendo etapa para o erro apontar a célula.
  const candidates = h.filter((c) => c !== periodCol && !/^(obs|observa|nota|coment)/.test(normalizeText(c)));
  const numeric = candidates.filter((c) => sheet.rows.some((r) => numberCell(r.cells[c]).value !== null));
  const stageCols = numeric.length ? numeric : candidates;
  if (!stageCols.length) return issues.error("missing_column", "A aba Funil não tem colunas de etapas.", { sheet: sheet.name });
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    if (!period) continue;
    const a = acc(period);
    stageCols.forEach((col, i) => {
      const qty = numberCell(row.cells[col]);
      if (qty.invalid) issues.error("invalid_number", `O valor de "${col}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: col });
      a.funnel.set(slugify(col) || `etapa-${i + 1}`, { label: col, order: i + 1, value: qty.value === null ? null : Math.max(0, qty.value) });
    });
    a.sections.add("funnel");
  }
}

function readFinancial(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const attributedCol = findColumn(h, ["receita atribuida", "receita de midia", "receita midia paga", "attributed revenue"]);
  const revenueCol = findColumn(h, ["receita", "receita total", "faturamento", "revenue"], [attributedCol]);
  const investCol = findColumn(h, ["investimento em midia", "investimento", "investimento total", "valor investido", "media investment"]);
  const salesCol = findColumn(h, ["vendas", "numero de vendas", "qtd vendas", "sales"]);
  const otherCol = findColumn(h, ["outros custos", "other costs"]);
  const ticketCol = findColumn(h, ["ticket medio", "ticket", "average ticket"]);
  if (!revenueCol && !investCol) return issues.error("missing_column", 'A aba Financeiro precisa de pelo menos a coluna "Receita" ou "Investimento em mídia".', { sheet: sheet.name });
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    if (!period) continue;
    const read = (col: string | null) => {
      if (!col) return null;
      const n = numberCell(row.cells[col]);
      if (n.invalid) issues.error("invalid_number", `O valor de "${col}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: col });
      return n.value;
    };
    const a = acc(period);
    a.financial = {
      revenue: read(revenueCol),
      mediaInvestment: read(investCol),
      sales: read(salesCol),
      attributedRevenue: read(attributedCol),
      otherCosts: read(otherCol),
      averageTicket: read(ticketCol),
    };
    a.sections.add("financial");
  }
}

export function inferChannelKind(name: string, declared: string | null): ChannelKind {
  const d = declared ? normalizeText(declared) : "";
  if (d) {
    if (/pag|paid|ads|anuncio|midia/.test(d)) return "paid";
    if (/organ/.test(d)) return "organic";
    if (/indica|referr/.test(d)) return "referral";
    if (/recorr|recurr|fideli/.test(d)) return "recurring";
    if (/plataforma|marketplace|diretorio/.test(d)) return "marketplace";
    if (/offline|impress|panflet/.test(d)) return "offline";
    if (/parc|partner/.test(d)) return "partner";
  }
  const n = normalizeText(name);
  if (/\b(ads|google ads|meta ads|facebook ads|instagram ads|tiktok ads|trafego pago|anuncio)/.test(n) || /^(meta|instagram|facebook)$/.test(n)) return "paid";
  if (/indica/.test(n)) return "referral";
  if (/recorr/.test(n)) return "recurring";
  if (/doctoralia|marketplace|sites de/.test(n)) return "marketplace";
  if (/organ|site|seo|google$/.test(n)) return "organic";
  if (/panflet|jornal|radio|outdoor|evento/.test(n)) return "offline";
  if (/parc/.test(n)) return "partner";
  return "other";
}

function readChannels(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const nameCol = findColumn(h, ["canal", "origem", "fonte", "channel", "source", "nome"], [periodCol]);
  if (!nameCol) return issues.error("missing_column", 'A coluna "Canal" não foi encontrada na aba Canais.', { sheet: sheet.name, column: "Canal" });
  const kindCol = findColumn(h, ["tipo", "tipo de canal", "categoria", "kind"], [nameCol]);
  const leadsCol = findColumn(h, ["leads", "contatos", "oportunidades"]);
  const convCol = findColumn(h, ["conversoes", "conversao", "fechamentos", "vendas", "comparecimentos", "clientes", "conversions"]);
  const revenueCol = findColumn(h, ["receita", "faturamento", "revenue"]);
  const investCol = findColumn(h, ["investimento", "valor investido", "midia", "investment"]);
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const label = textCell(row.cells[nameCol]);
    if (!period || !label) continue;
    const read = (col: string | null) => {
      if (!col) return null;
      const n = numberCell(row.cells[col]);
      if (n.invalid) issues.error("invalid_number", `O valor de "${col}" do canal "${label}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: col });
      return n.value;
    };
    const a = acc(period);
    const key = slugify(label) || `canal-${row.line}`;
    const existing = a.channels.findIndex((c) => c.key === key);
    const channel = {
      key,
      label,
      kind: inferChannelKind(label, kindCol ? textCell(row.cells[kindCol]) : null),
      leads: read(leadsCol),
      conversions: read(convCol),
      revenue: read(revenueCol),
      investment: read(investCol),
    };
    if (existing >= 0) a.channels[existing] = channel;
    else a.channels.push(channel);
    a.sections.add("channels");
  }
}

const DIM_ITEM = ["item", "nome", "descricao", "servico", "profissional", "terapeuta", "unidade", "produto", "especialidade", "procedimento", "categoria", "tipo"];

function readDimensionRows(sheet: RawSheet, rows: RawSheet["rows"], dimLabel: string, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc, exclude: Array<string | null>) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const itemCol = findColumn(h, DIM_ITEM, [periodCol, ...exclude]) ?? h.find((c) => c !== periodCol && !exclude.includes(c)) ?? null;
  if (!itemCol) return issues.error("missing_column", `A aba ${sheet.name} precisa de uma coluna com o nome de cada item.`, { sheet: sheet.name });
  const leadsCol = findColumn(h, ["leads", "contatos"], [itemCol]);
  const convCol = findColumn(h, ["conversoes", "conversao", "fechamentos", "conversions"], [itemCol]);
  const revenueCol = findColumn(h, ["receita", "faturamento", "revenue", "valor"], [itemCol]);
  const qtyCol = findColumn(h, ["quantidade", "qtd", "atendimentos", "sessoes", "vendas", "volume", "clientes", "total"], [itemCol, leadsCol, convCol, revenueCol]);
  const noteCol = findColumn(h, ["observacao", "obs", "status", "nota"], [itemCol]);
  if (!leadsCol && !convCol && !revenueCol && !qtyCol) {
    return issues.warn("unrecognized_sheet", `A aba "${sheet.name}" não tem colunas numéricas reconhecidas (Leads, Conversões, Quantidade ou Receita) e foi ignorada.`, { sheet: sheet.name });
  }
  const dimKey = slugify(dimLabel) || "dimensao";
  for (const row of rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const label = textCell(row.cells[itemCol]);
    if (!period || !label) continue;
    const read = (col: string | null) => {
      if (!col) return null;
      const n = numberCell(row.cells[col]);
      if (n.invalid) issues.error("invalid_number", `O valor de "${col}" em "${label}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: col });
      return n.value === null ? null : Math.abs(n.value);
    };
    const a = acc(period);
    let d = a.dimensions.get(dimKey);
    if (!d) {
      d = { label: dimLabel, quantityLabel: qtyCol && normalizeText(qtyCol) !== "quantidade" ? qtyCol : null, rows: [] };
      a.dimensions.set(dimKey, d);
    }
    d.rows.push({ key: slugify(label) || `item-${row.line}`, label, leads: read(leadsCol), conversions: read(convCol), quantity: read(qtyCol), revenue: read(revenueCol), note: noteCol ? textCell(row.cells[noteCol]) : null });
    a.sections.add("dimensions");
  }
}

function readDimension(sheet: RawSheet, label: string, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  readDimensionRows(sheet, sheet.rows, label, ctx, issues, acc, []);
}

/** Aba "Dimensões" com coluna "Dimensão" agrupando vários tipos numa só tabela. */
function readDimensionsLong(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const dimCol = findColumn(sheet.headers, ["dimensao", "grupo", "dimension"]);
  if (!dimCol) return readDimension(sheet, sheet.name, ctx, issues, acc);
  const groups = new Map<string, RawSheet["rows"]>();
  for (const row of sheet.rows) {
    const g = textCell(row.cells[dimCol]);
    if (g) groups.set(g, [...(groups.get(g) ?? []), row]);
  }
  for (const [label, rows] of groups) readDimensionRows(sheet, rows, label, ctx, issues, acc, [dimCol]);
}

function readExtraMetrics(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const nameCol = findColumn(h, ["indicador", "metrica", "nome", "indicator"], [periodCol]);
  const valueCol = findColumn(h, ["valor", "quantidade", "total", "value"], [nameCol]);
  if (!nameCol || !valueCol) return issues.error("missing_column", 'A aba Indicadores precisa das colunas "Indicador" e "Valor".', { sheet: sheet.name });
  const formatCol = findColumn(h, ["formato", "tipo", "format"], [nameCol, valueCol]);
  const dirCol = findColumn(h, ["direcao", "melhor quando", "direction"], [nameCol, valueCol]);
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const label = textCell(row.cells[nameCol]);
    if (!period || !label) continue;
    const fmt = normalizeText(formatCol ? (textCell(row.cells[formatCol]) ?? "") : "");
    const format = /moeda|real|r\$|currency|valor/.test(fmt) ? "currency" : /percent|%|taxa/.test(fmt) ? "percent" : /decimal/.test(fmt) ? "decimal" : "integer";
    const n = numberCell(row.cells[valueCol]);
    if (n.invalid) issues.error("invalid_number", `O valor do indicador "${label}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: valueCol });
    const dir = normalizeText(dirCol ? (textCell(row.cells[dirCol]) ?? "") : "");
    const a = acc(period);
    a.extraMetrics.push({
      key: slugify(label) || `indicador-${row.line}`,
      label,
      value: format === "percent" && n.value !== null && Math.abs(n.value) > 1 ? n.value / 100 : n.value,
      format,
      direction: /menor|baix|lower/.test(dir) ? "lowerIsBetter" : /maior|alt|higher/.test(dir) ? "higherIsBetter" : "neutral",
    });
    a.sections.add("extraMetrics");
  }
}

function readInsights(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const titleCol = findColumn(h, ["titulo", "title", "destaque"]);
  const descCol = findColumn(h, ["descricao", "texto", "description", "detalhe", "comentario"], [titleCol]);
  const typeCol = findColumn(h, ["tipo", "categoria", "type"], [titleCol, descCol]);
  if (!titleCol) return issues.error("missing_column", 'A coluna "Título" não foi encontrada na aba Insights.', { sheet: sheet.name, column: "Título" });
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const title = textCell(row.cells[titleCol]);
    if (!period || !title) continue;
    acc(period).insights.push({ type: mapInsightType(typeCol ? textCell(row.cells[typeCol]) : null), title: title.slice(0, 140), description: (descCol ? (textCell(row.cells[descCol]) ?? "") : "").slice(0, 1500) });
  }
}

function readContext(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const titleCol = findColumn(h, ["titulo", "title", "contexto"]);
  const descCol = findColumn(h, ["descricao", "texto", "description"], [titleCol]);
  if (!titleCol) return issues.error("missing_column", 'A coluna "Título" não foi encontrada na aba Contexto.', { sheet: sheet.name });
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const title = textCell(row.cells[titleCol]);
    if (!period || !title) continue;
    const a = acc(period);
    a.context = { title, description: descCol ? (textCell(row.cells[descCol]) ?? "") : "" };
    a.sections.add("context");
  }
}

/** Avisos de consistência: não impedem a importação. */
function warnCommercial(data: CommercialDataInput, label: string, issues: IssueCollector, partial: boolean) {
  const stages = data.funnel;
  const first = stages[0]?.value ?? null;
  if (!partial) {
    if (!data.financial || data.financial.revenue == null) issues.warn("missing_revenue", `Receita não informada em ${label} — os indicadores de retorno não serão exibidos.`);
    if (!data.channels?.length) issues.warn("missing_channels", `Nenhum canal informado em ${label} — a seção "Canais de origem" não aparecerá.`);
  }
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].value;
    const cur = stages[i].value;
    if (prev !== null && cur !== null && cur > prev) issues.warn("funnel_increase", `Em ${label}, a etapa "${stages[i].label}" (${formatInteger(cur)}) é maior que "${stages[i - 1].label}" (${formatInteger(prev)}). Confira se a ordem das etapas está correta.`);
  }
  for (const c of data.channels ?? []) {
    if (c.conversions == null && c.leads != null) issues.warn("channel_no_conversion", `O canal "${c.label}" não tem conversões informadas em ${label}.`);
  }
  const leadSum = (data.channels ?? []).reduce((s, c) => s + (c.leads ?? 0), 0);
  if (first !== null && leadSum > 0 && Math.abs(leadSum - first) > Math.max(1, first * 0.02)) {
    issues.warn("channel_sum_mismatch", `Em ${label}, a soma dos leads por canal (${formatInteger(leadSum)}) é diferente do total do funil (${formatInteger(first)}).`);
  }
}
