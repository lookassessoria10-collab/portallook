import { formatInteger } from "@/lib/format/number";
import { normalizeText, slugify } from "@/lib/ids";
import { formatDate, formatPeriod, periodKey, type Period } from "@/lib/dates/period";
import { dateCell, findColumn, numberCell, textCell } from "@/lib/parsers/cells";
import type { CellValue, RawSheet, RawWorkbook } from "@/lib/parsers/types";
import type { IssueCollector } from "@/features/uploads/issues";
import { isTotalLabel, resolveRowPeriod, type PeriodContext } from "@/features/uploads/row-period";
import type { CommercialSection, ParsedInsight, ParsedPeriod } from "@/features/uploads/parsed";
import { mapInsightType } from "@/features/uploads/insight-type";
import type { ChannelKind, CommercialDataInput } from "./schema";

/**
 * Planilha (qualquer layout razoável) → modelo comercial padronizado.
 * Os componentes visuais nunca veem a planilha: só o CommercialData.
 */
export type SheetRole = "funnel" | "financial" | "channels" | "customers" | "table" | "dimension" | "dimensions" | "extraMetrics" | "insights" | "context" | "comparison" | "notes";

const ROLE_ALIASES: Array<[SheetRole, string[]]> = [
  ["funnel", ["funil", "funnel", "etapas", "pipeline"]],
  ["financial", ["financeiro", "financial", "financas", "faturamento"]],
  ["channels", ["canais", "canal", "origem", "origens", "channels", "origem dos leads"]],
  ["customers", ["clientes", "novos x recorrentes", "novos e recorrentes", "novos vs recorrentes", "tipo de cliente", "tipos de cliente", "base de clientes"]],
  // Tabelas exibidas como vieram: o que não é número calculável (agenda já marcada, próximos passos…).
  ["table", ["oportunidades", "oportunidades abertas", "agendamentos futuros", "agenda futura", "plano de acao", "plano de acoes", "acoes", "proximos passos", "motivos de perda", "pendencias", "tabela"]],
  ["dimensions", ["dimensoes", "dimensions", "detalhamento"]],
  ["extraMetrics", ["indicadores", "kpis", "metricas", "indicadores adicionais"]],
  ["insights", ["insights", "analise", "analises", "observacoes", "comentarios"]],
  ["context", ["contexto", "context", "avisos"]],
  // Leitura da Look para cada indicador no comparativo com o período anterior.
  ["comparison", ["comparativo", "comparacao", "leituras", "leitura"]],
  // Destaques escritos pela Look para seções do painel (ex.: ao lado do funil, da receita por canal).
  ["notes", ["notas", "notas do painel", "notas das secoes", "destaques"]],
];

const IGNORED_SHEETS = ["instrucoes", "leia me", "leiame", "readme", "como usar", "exemplo", "modelo", "config"];

export function classifySheet(name: string): SheetRole | "ignored" {
  const n = normalizeText(name);
  if (IGNORED_SHEETS.some((a) => n === a || n.startsWith(`${a} `))) return "ignored";
  for (const [role, aliases] of ROLE_ALIASES) if (aliases.some((a) => n === a || n.startsWith(`${a} `))) return role;
  return "dimension";
}

const PERIOD = ["periodo", "mes", "mes de referencia", "competencia", "referencia", "period", "month", "semana", "week", "data"];

/** Dias com dados no período (ex.: janeiro parcial, 16 dias): coluna no Funil/Financeiro ou indicador. */
const DAYS = ["dias", "dias registrados", "dias no periodo", "dias do periodo", "dias com dados", "dias de operacao"];

/**
 * Linha de total ou subtotal ("Total", "Total informado", "Total dos canais pagos", "Subtotal",
 * "Soma") não é um item: se entrasse como canal, serviço ou profissional, seria somada duas vezes.
 */
function isSummaryRow(label: string | null): boolean {
  return Boolean(label) && (isTotalLabel(label) || /^(sub ?)?(total|totais)\b|^soma\b/.test(normalizeText(label!)));
}

function warnSummaryRows(issues: IssueCollector, sheet: RawSheet, labels: Set<string>) {
  if (!labels.size) return;
  const list = [...labels].map((l) => `"${l}"`).join(", ");
  issues.warn("summary_rows_skipped", `Na aba ${sheet.name}, ${labels.size === 1 ? "a linha" : "as linhas"} ${list} ${labels.size === 1 ? "foi tratada" : "foram tratadas"} como total e não ${labels.size === 1 ? "entrou" : "entraram"} nas somas — o portal soma os itens sozinho.`, { sheet: sheet.name });
}

interface Acc {
  period: Period;
  funnel: Map<string, { label: string; order: number; value: number | null }>;
  financial: NonNullable<CommercialDataInput["financial"]> | null;
  channels: NonNullable<CommercialDataInput["channels"]>;
  dimensions: Map<string, { label: string; quantityLabel: string | null; rows: NonNullable<CommercialDataInput["dimensions"]>[number]["rows"] }>;
  extraMetrics: NonNullable<CommercialDataInput["extraMetrics"]>;
  customers: { new: number | null; returning: number | null } | null;
  days: number | null;
  tables: Map<string, { title: string; columns: string[]; rows: string[][] }>;
  context: CommercialDataInput["context"];
  comparisonNotes: Array<{ label: string; text: string }>;
  sectionNotes: Array<{ section: string; text: string }>;
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
  customers: "Clientes (novos × recorrentes)",
  table: "Tabela",
  dimension: "Dimensão",
  dimensions: "Dimensões",
  extraMetrics: "Indicadores",
  insights: "Insights",
  context: "Contexto",
  comparison: "Comparativo (leituras)",
  notes: "Notas do painel",
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
      a = { period: p, funnel: new Map(), financial: null, channels: [], dimensions: new Map(), extraMetrics: [], customers: null, days: null, tables: new Map(), context: null, comparisonNotes: [], sectionNotes: [], insights: [], sections: new Set() };
      accs.set(key, a);
    }
    return a;
  };

  const sheets: CommercialNormalizeResult["sheets"] = [];
  let untitledTables = 0;
  for (const [index, sheet] of workbook.sheets.entries()) {
    // Dados colados: só a primeira tabela pode ficar sem título (vira Funil); as outras precisam dizer o que são.
    if (sheet.untitled && untitledTables++ > 0) {
      issues.error("untitled_table", `A ${index + 1}ª tabela colada não tem título. Escreva o nome da seção na linha de cima dela (ex.: ## Financeiro, ## Canais).`, { sheet: sheet.name });
      sheets.push({ name: sheet.name, rows: sheet.rows.length, recognizedAs: null });
      continue;
    }
    const role = ctx.csvRole ?? classifySheet(sheet.name);
    if (role === "ignored" || sheet.rows.length === 0) {
      sheets.push({ name: sheet.name, rows: sheet.rows.length, recognizedAs: null });
      continue;
    }
    sheets.push({ name: sheet.name, rows: sheet.rows.length, recognizedAs: role === "dimension" ? (hasDimensionMeasures(sheet) ? `Detalhamento: ${ctx.csvDimensionLabel ?? sheet.name}` : `Tabela: ${sheet.name}`) : role === "table" ? `Tabela: ${tableTitle(sheet.name)}` : ROLE_LABEL[role] });
    const handlers: Record<SheetRole, () => void> = {
      funnel: () => readFunnel(sheet, ctx, issues, acc),
      financial: () => readFinancial(sheet, ctx, issues, acc),
      channels: () => readChannels(sheet, ctx, issues, acc),
      customers: () => readCustomers(sheet, ctx, issues, acc),
      table: () => readTable(sheet, ctx, issues, acc),
      dimension: () => readDimension(sheet, ctx.csvDimensionLabel ?? sheet.name, ctx, issues, acc),
      dimensions: () => readDimensionsLong(sheet, ctx, issues, acc),
      extraMetrics: () => readExtraMetrics(sheet, ctx, issues, acc),
      insights: () => readInsights(sheet, ctx, issues, acc),
      context: () => readContext(sheet, ctx, issues, acc),
      comparison: () => readComparison(sheet, ctx, issues, acc),
      notes: () => readSectionNotes(sheet, ctx, issues, acc),
    };
    handlers[role]();
  }

  const partial = Boolean(ctx.csvRole);
  const hasFunnelSheet = workbook.sheets.some((s) => classifySheet(s.name) === "funnel");
  if (!partial && !hasFunnelSheet) {
    issues.error("missing_sheet", 'A aba "Funil" não foi encontrada. Ela é obrigatória para o relatório comercial (baixe o modelo para ver o formato).');
  }

  const periods: ParsedPeriod[] = [];
  for (const [key, a] of [...accs.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const label = formatPeriod(a.period);
    const funnel = [...a.funnel.entries()].map(([k, s]) => ({ key: k, label: s.label, order: s.order, value: s.value })).sort((x, y) => x.order - y.order);
    if (!partial && !funnel.length) {
      // Sem aba Funil, o erro acima já explica; aqui é só o período que ficou sem funil.
      if (hasFunnelSheet) issues.error("missing_funnel", `A aba Funil não tem dados para ${label}, mas outras abas têm. Inclua o funil desse período ou remova as linhas dele.`);
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
      customers: a.customers,
      days: a.days,
      tables: [...a.tables.entries()].filter(([, t]) => t.rows.length).map(([k, t]) => ({ key: k, title: t.title, columns: t.columns, rows: t.rows })),
      comparisonNotes: a.comparisonNotes,
      sectionNotes: a.sectionNotes,
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
    if (!qtyCol) return issues.error("missing_column", 'A coluna "Quantidade" não foi encontrada na aba Funil (formato com coluna Etapa). Nomes aceitos: Quantidade, Qtd, Valor, Total, Volume.', { sheet: sheet.name, column: "Quantidade" });
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
  // Taxas e totais ("Taxa de conversão (%)", "Total") são calculados pelo sistema: não são etapas.
  const derived = h.filter((c) => c !== periodCol && (/^(taxa|conversao|percentual|total)\b/.test(normalizeText(c)) || c.includes("%")));
  if (derived.length) issues.warn("funnel_rate_columns", `As colunas ${derived.map((c) => `"${c}"`).join(", ")} da aba Funil foram ignoradas: taxas e totais são calculados pelo portal.`, { sheet: sheet.name });
  const cust = customerColumns(h, [periodCol]);
  const daysCol = h.find((c) => DAYS.includes(normalizeText(c))) ?? null;
  const candidates = h.filter((c) => c !== periodCol && c !== daysCol && c !== cust.newCol && c !== cust.returningCol && !derived.includes(c) && !/^(obs|observa|nota|coment)/.test(normalizeText(c)));
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
    readCustomerCells(sheet, row, cust, issues, a);
    readDays(sheet, row, daysCol, issues, a);
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
  if (!revenueCol && !investCol) return issues.error("missing_column", 'A aba Financeiro precisa de pelo menos a coluna "Receita" (ou Receita total, Faturamento) ou "Investimento em mídia" (ou Investimento, Valor investido).', { sheet: sheet.name });
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
    readCustomerCells(sheet, row, customerColumns(h, [periodCol, revenueCol, investCol, salesCol, attributedCol, otherCol, ticketCol]), issues, a);
    readDays(sheet, row, h.find((c) => DAYS.includes(normalizeText(c))) ?? null, issues, a);
  }
}

function readDays(sheet: RawSheet, row: RawSheet["rows"][number], col: string | null, issues: IssueCollector, a: Acc) {
  if (!col) return;
  const n = numberCell(row.cells[col]);
  if (n.invalid) issues.error("invalid_number", `O valor de "${col}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: col });
  if (n.value !== null) a.days = Math.max(0, Math.round(n.value));
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
  if (!nameCol) return issues.error("missing_column", 'A coluna "Canal" não foi encontrada na aba Canais. Nomes aceitos: Canal, Origem, Fonte, Nome.', { sheet: sheet.name, column: "Canal" });
  const kindCol = findColumn(h, ["tipo", "tipo de canal", "categoria", "kind"], [nameCol]);
  const leadsCol = findColumn(h, ["leads", "contatos", "oportunidades"]);
  const convCol = findColumn(h, ["conversoes", "conversao", "fechamentos", "vendas", "comparecimentos", "clientes", "conversions"]);
  const revenueCol = findColumn(h, ["receita", "faturamento", "revenue"]);
  const investCol = findColumn(h, ["investimento", "valor investido", "midia", "investment"]);
  const skipped = new Set<string>();
  for (const row of sheet.rows) {
    const label = textCell(row.cells[nameCol]);
    if (isSummaryRow(label)) {
      if (!isTotalLabel(label)) skipped.add(label!);
      continue;
    }
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
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
    if (existing >= 0) issues.warn("duplicate_item", `O canal "${label}" aparece mais de uma vez em ${formatPeriod(period)} (aba ${sheet.name}, linha ${row.line}): vale a última linha, sem somar as duas.`, { sheet: sheet.name, row: row.line });
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
  warnSummaryRows(issues, sheet, skipped);
}

const DIM_ITEM = ["item", "nome", "descricao", "servico", "profissional", "terapeuta", "massagem", "unidade", "produto", "especialidade", "procedimento", "categoria", "tipo"];

/** Colunas de um detalhamento (serviços, profissionais…): nome do item, medidas e status. */
function dimensionColumns(h: string[], exclude: Array<string | null>) {
  const periodCol = findColumn(h, PERIOD);
  const itemCol = findColumn(h, DIM_ITEM, [periodCol, ...exclude]) ?? h.find((c) => c !== periodCol && !exclude.includes(c)) ?? null;
  const leadsCol = findColumn(h, ["leads", "contatos"], [itemCol]);
  const convCol = findColumn(h, ["conversoes", "conversao", "fechamentos", "conversions"], [itemCol]);
  const revenueCol = findColumn(h, ["receita", "faturamento", "revenue", "valor"], [itemCol]);
  const qtyCol = findColumn(h, ["quantidade", "qtd", "atendimentos", "sessoes", "vendas", "volume", "clientes", "total"], [itemCol, leadsCol, convCol, revenueCol]);
  const noteCol = findColumn(h, ["status", "situacao", "observacao", "obs", "nota"], [itemCol]);
  return { periodCol, itemCol, leadsCol, convCol, revenueCol, qtyCol, noteCol };
}

/** A aba tem números de detalhamento? Sem eles, ela é uma tabela livre (ex.: "Próximos passos"). */
function hasDimensionMeasures(sheet: RawSheet): boolean {
  const c = dimensionColumns(sheet.headers, []);
  return Boolean(c.itemCol && (c.leadsCol || c.convCol || c.revenueCol || c.qtyCol));
}

function readDimensionRows(sheet: RawSheet, rows: RawSheet["rows"], dimLabel: string, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc, exclude: Array<string | null>) {
  const { periodCol, itemCol, leadsCol, convCol, revenueCol, qtyCol, noteCol } = dimensionColumns(sheet.headers, exclude);
  if (!itemCol) return issues.error("missing_column", `A aba ${sheet.name} precisa de uma coluna com o nome de cada item.`, { sheet: sheet.name });
  if (!leadsCol && !convCol && !revenueCol && !qtyCol) {
    return issues.warn("unrecognized_sheet", `A aba "${sheet.name}" não tem colunas numéricas reconhecidas (Leads, Conversões, Quantidade ou Receita) e foi ignorada.`, { sheet: sheet.name });
  }
  const dimKey = slugify(dimLabel) || "dimensao";
  const skipped = new Set<string>();
  for (const row of rows) {
    const label = textCell(row.cells[itemCol]);
    if (isSummaryRow(label)) {
      if (!isTotalLabel(label)) skipped.add(label!);
      continue;
    }
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
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
    const item = { key: slugify(label) || `item-${row.line}`, label, leads: read(leadsCol), conversions: read(convCol), quantity: read(qtyCol), revenue: read(revenueCol), note: noteCol ? textCell(row.cells[noteCol]) : null };
    const existing = d.rows.findIndex((r) => r.key === item.key);
    if (existing >= 0) {
      issues.warn("duplicate_item", `"${label}" aparece mais de uma vez em ${formatPeriod(period)} (aba ${sheet.name}, linha ${row.line}): vale a última linha, sem somar as duas.`, { sheet: sheet.name, row: row.line });
      d.rows[existing] = item;
    } else d.rows.push(item);
    a.sections.add("dimensions");
  }
  warnSummaryRows(issues, sheet, skipped);
}

function readDimension(sheet: RawSheet, label: string, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  if (!hasDimensionMeasures(sheet)) return readTable(sheet, ctx, issues, acc);
  readDimensionRows(sheet, sheet.rows, label, ctx, issues, acc, []);
}

/** "Tabela Conversão por canal" força uma tabela livre mesmo com números; o prefixo sai do título. */
function tableTitle(name: string): string {
  return name.trim().replace(/^tabela\s*[:\-–—]?\s*/i, "") || name.trim();
}

/** Tabela livre: cada linha como veio, por período (coluna Mês ou o período escolhido no assistente). */
function readTable(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const columns = h.filter((c) => c !== periodCol && sheet.rows.some((r) => tableCell(r.cells[c]) !== ""));
  if (!columns.length) return;
  const title = tableTitle(sheet.name);
  const key = slugify(title) || "tabela";
  for (const row of sheet.rows) {
    const cells = columns.map((c) => tableCell(row.cells[c]));
    if (cells.every((c) => !c)) continue;
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    if (!period) continue;
    const a = acc(period);
    let t = a.tables.get(key);
    if (!t) {
      t = { title: title.slice(0, 120), columns: columns.map((c) => c.slice(0, 80)), rows: [] };
      a.tables.set(key, t);
    }
    t.rows.push(cells.map((c) => c.slice(0, 500)));
    a.sections.add("tables");
  }
}

function tableCell(v: CellValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatDate(dateCell(v));
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return textCell(v) ?? "";
}

/** Novos × recorrentes: só nomes exatos, para não confundir com etapas como "Novos contatos". */
const NEW_CUSTOMERS = ["novos clientes", "clientes novos", "novos", "primeira vez", "novos pacientes", "pacientes novos", "new customers"];
const RETURNING_CUSTOMERS = ["clientes recorrentes", "recorrentes", "recorrencia", "clientes de retorno", "pacientes recorrentes", "returning customers"];

function customerColumns(headers: string[], exclude: Array<string | null>) {
  const find = (aliases: string[], skip: Array<string | null>) => headers.find((c) => !skip.includes(c) && aliases.includes(normalizeText(c))) ?? null;
  const newCol = find(NEW_CUSTOMERS, exclude);
  return { newCol, returningCol: find(RETURNING_CUSTOMERS, [...exclude, newCol]) };
}

function readCustomerCells(sheet: RawSheet, row: RawSheet["rows"][number], cols: { newCol: string | null; returningCol: string | null }, issues: IssueCollector, a: Acc) {
  if (!cols.newCol && !cols.returningCol) return;
  const read = (col: string | null) => {
    if (!col) return null;
    const n = numberCell(row.cells[col]);
    if (n.invalid) issues.error("invalid_number", `O valor de "${col}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: col });
    return n.value === null ? null : Math.abs(n.value);
  };
  setCustomers(a, read(cols.newCol), read(cols.returningCol));
}

function setCustomers(a: Acc, fresh: number | null, returning: number | null) {
  if (fresh === null && returning === null) return;
  a.customers = { new: fresh ?? a.customers?.new ?? null, returning: returning ?? a.customers?.returning ?? null };
  a.sections.add("customers");
}

/**
 * Aba Clientes: colunas Novos | Recorrentes (uma linha por mês) ou Tipo | Quantidade.
 * Sem novos/recorrentes, "Clientes" é um detalhamento comum (ex.: clientes por cidade).
 */
function readCustomers(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const cols = customerColumns(h, [periodCol]);
  const typeCol = cols.newCol || cols.returningCol ? null : findColumn(h, ["tipo de cliente", "tipo", "categoria"], [periodCol]);
  const qtyCol = typeCol ? findColumn(h, ["quantidade", "clientes", "total", "qtd"], [periodCol, typeCol]) : null;
  if (!cols.newCol && !cols.returningCol && !(typeCol && qtyCol)) return readDimension(sheet, sheet.name, ctx, issues, acc);
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    if (!period) continue;
    if (typeCol && qtyCol) {
      const type = normalizeText(textCell(row.cells[typeCol]) ?? "");
      const n = numberCell(row.cells[qtyCol]);
      if (n.invalid) issues.error("invalid_number", `O valor de "${qtyCol}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: qtyCol });
      if (n.value === null) continue;
      if (/^novo|primeira/.test(type)) setCustomers(acc(period), Math.abs(n.value), null);
      else if (/recorr|retorno/.test(type)) setCustomers(acc(period), null, Math.abs(n.value));
      continue;
    }
    readCustomerCells(sheet, row, cols, issues, acc(period));
  }
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
  if (!nameCol || !valueCol) return issues.error("missing_column", 'A aba Indicadores precisa das colunas "Indicador" (ou Métrica, Nome) e "Valor" (ou Quantidade, Total).', { sheet: sheet.name });
  const computed = new Set<string>();
  const formatCol = findColumn(h, ["formato", "tipo", "format"], [nameCol, valueCol]);
  const dirCol = findColumn(h, ["direcao", "melhor quando", "direction"], [nameCol, valueCol]);
  const formatOf = (row: RawSheet["rows"][number]) => {
    const fmt = normalizeText(formatCol ? (textCell(row.cells[formatCol]) ?? "") : "");
    return /moeda|real|r\$|currency|valor/.test(fmt) ? "currency" : /percent|%|taxa/.test(fmt) ? "percent" : /multiplic|vezes|roas|^x$/.test(fmt) ? "multiplier" : /decimal/.test(fmt) ? "decimal" : "integer";
  };
  // Escala dos percentuais da aba: frações (0,244 = 24,4%; 2,614 = 261,4%) ou de 0 a 100 (24,4 = 24,4%).
  // Se algum percentual numérico está entre 0 e 1, a aba usa frações e nenhum valor é dividido — um ROI
  // de 261,4% (2,614) não pode virar 2,6%. "261,4%" escrito com o símbolo já é lido como fração.
  const fractionScale = sheet.rows.some((row) => {
    const v = row.cells[valueCol];
    return formatOf(row) === "percent" && typeof v === "number" && v !== 0 && Math.abs(v) < 1;
  });
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const label = textCell(row.cells[nameCol]);
    if (!period || !label) continue;
    const format = formatOf(row);
    const raw = row.cells[valueCol];
    const n = numberCell(raw);
    if (n.invalid) issues.error("invalid_number", `O valor do indicador "${label}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { sheet: sheet.name, row: row.line, column: valueCol });
    const dir = normalizeText(dirCol ? (textCell(row.cells[dirCol]) ?? "") : "");
    const a = acc(period);
    // "Novos clientes" e "Clientes recorrentes" têm lugar próprio no portal (novos × recorrentes).
    const name = normalizeText(label);
    if (NEW_CUSTOMERS.includes(name) || RETURNING_CUSTOMERS.includes(name)) {
      if (!n.invalid && n.value !== null) setCustomers(a, NEW_CUSTOMERS.includes(name) ? Math.abs(n.value) : null, RETURNING_CUSTOMERS.includes(name) ? Math.abs(n.value) : null);
      continue;
    }
    // "Dias registrados" vira a coluna Dias da tabela mês a mês.
    if (DAYS.includes(name)) {
      if (!n.invalid && n.value !== null) a.days = Math.max(0, Math.round(n.value));
      continue;
    }
    if (COMPUTED_INDICATOR.test(name)) computed.add(label);
    const alreadyFraction = typeof raw === "string" && raw.includes("%");
    a.extraMetrics.push({
      key: slugify(label) || `indicador-${row.line}`,
      label,
      value: format === "percent" && n.value !== null && !alreadyFraction && !fractionScale ? n.value / 100 : n.value,
      format,
      direction: /menor|baix|lower/.test(dir) ? "lowerIsBetter" : /maior|alt|higher/.test(dir) ? "higherIsBetter" : "neutral",
    });
    a.sections.add("extraMetrics");
  }
  if (computed.size) {
    const list = [...computed].slice(0, 6).map((l) => `"${l}"`).join(", ");
    issues.warn(
      "computed_indicators",
      `${computed.size === 1 ? "O indicador" : "Os indicadores"} ${list}${computed.size > 6 ? " e outros" : ""} ${computed.size === 1 ? "parece" : "parecem"} algo que o portal já calcula sozinho (acumulados na visão geral, conversões do funil, ROI e participação de cada canal, ticket médio). Se for, pode tirar da aba Indicadores para não repetir no relatório.`,
      { sheet: sheet.name },
    );
  }
}

/** Indicadores que o portal já calcula (acumulados, conversões, ROI/ROAS, ticket, participação, custos por resultado, receita/investimento por canal). */
const COMPUTED_INDICATOR =
  /acumulad|^(taxa de )?conversao\b|^lead\b.*\b(agend|comparec|paciente|cliente)|^agend\b.*\bcomparec|^ticket medio|^roi\b|^roas\b|^retorno (sobre|por|da midia)|^participacao\b|^custo por\b|^cpl\b|^cpa\b|^resultado liquido|^receita (de |do |da )?(indicacao|google|instagram|meta|ads|doctoralia|outros|sites?)|^investimento (de |do |da |em )?(meta|google|instagram|ads|sites?)/;

function readInsights(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const titleCol = findColumn(h, ["titulo", "title", "destaque"]);
  const descCol = findColumn(h, ["descricao", "texto", "description", "detalhe", "comentario"], [titleCol]);
  const typeCol = findColumn(h, ["tipo", "categoria", "type"], [titleCol, descCol]);
  // Tema do cartão (ex.: "Recorrência", "Terapeutas"); a cor continua vindo do Tipo.
  const tagCol = findColumn(h, ["tema", "assunto", "topico", "tag"], [titleCol, descCol, typeCol]);
  if (!titleCol) return issues.error("missing_column", 'A coluna "Título" não foi encontrada na aba Insights.', { sheet: sheet.name, column: "Título" });
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const title = textCell(row.cells[titleCol]);
    if (!period || !title) continue;
    acc(period).insights.push({
      type: mapInsightType(typeCol ? textCell(row.cells[typeCol]) : null),
      title: title.slice(0, 140),
      description: (descCol ? (textCell(row.cells[descCol]) ?? "") : "").slice(0, 1500),
      tag: (tagCol ? textCell(row.cells[tagCol]) : null)?.slice(0, 40) ?? null,
    });
  }
}

/** Aba Comparativo: a leitura da Look para cada indicador (Indicador | Leitura), por período. */
function readComparison(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const labelCol = findColumn(h, ["indicador", "metrica", "nome"], [periodCol]);
  const textCol = findColumn(h, ["leitura", "analise", "comentario", "observacao", "descricao"], [periodCol, labelCol]);
  if (!labelCol || !textCol) return issues.error("missing_column", 'A aba Comparativo precisa das colunas "Indicador" e "Leitura".', { sheet: sheet.name });
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const label = textCell(row.cells[labelCol]);
    const text = textCell(row.cells[textCol]);
    if (!period || !label || !text) continue;
    const a = acc(period);
    a.comparisonNotes.push({ label: label.slice(0, 120), text: text.slice(0, 500) });
    a.sections.add("comparisonNotes");
  }
}

/** Aba Notas: o destaque da Look para uma seção do painel (Seção | Texto), por período. */
function readSectionNotes(sheet: RawSheet, ctx: PeriodContext, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const sectionCol = findColumn(h, ["secao", "bloco", "grafico", "quadro"], [periodCol]);
  const textCol = findColumn(h, ["texto", "nota", "destaque", "descricao", "leitura", "comentario"], [periodCol, sectionCol]);
  if (!sectionCol || !textCol) return issues.error("missing_column", 'A aba Notas precisa das colunas "Seção" e "Texto".', { sheet: sheet.name });
  for (const row of sheet.rows) {
    const period = resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
    const section = textCell(row.cells[sectionCol]);
    const text = textCell(row.cells[textCol]);
    if (!period || !section || !text) continue;
    const a = acc(period);
    a.sectionNotes.push({ section: section.slice(0, 80), text: text.slice(0, 1000) });
    a.sections.add("sectionNotes");
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
  // Só parece esquecimento quando alguns canais têm conversões e outros não (sem a coluna, é escolha do cliente).
  const someConversions = (data.channels ?? []).some((c) => c.conversions != null);
  for (const c of someConversions ? (data.channels ?? []) : []) {
    if (c.conversions == null && c.leads != null) issues.warn("channel_no_conversion", `O canal "${c.label}" não tem conversões informadas em ${label}.`);
  }
  const leadSum = (data.channels ?? []).reduce((s, c) => s + (c.leads ?? 0), 0);
  if (first !== null && leadSum > 0 && Math.abs(leadSum - first) > Math.max(1, first * 0.02)) {
    issues.warn("channel_sum_mismatch", `Em ${label}, a soma dos leads por canal (${formatInteger(leadSum)}) é diferente do total do funil (${formatInteger(first)}).`);
  }
}
