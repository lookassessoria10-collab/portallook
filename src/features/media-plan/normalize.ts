import { formatPeriod, monthPeriod, periodKey, type Period } from "@/lib/dates/period";
import { normalizeText, slugify } from "@/lib/ids";
import { dateCell, findColumn, numberCell, textCell } from "@/lib/parsers/cells";
import type { CellValue, RawSheet, RawWorkbook } from "@/lib/parsers/types";
import type { IssueCollector } from "@/features/uploads/issues";
import { isTotalLabel, resolveRowPeriod } from "@/features/uploads/row-period";
import { mapInsightType } from "@/features/uploads/insight-type";
import type { ParsedInsight, ParsedPeriod } from "@/features/uploads/parsed";
import { mapPlatform, mapResultType } from "@/features/traffic/normalize";
import type { MediaPlanBlock, MediaPlanDataInput, MediaPlanFigure } from "./schema";

/**
 * Planilha ou tabelas coladas → plano de mídia padronizado (modelo "Estratégia de
 * Mídia" da Look). Abas reconhecidas:
 *
 *   Plano / Campanhas   uma linha por campanha ou ação (obrigatória)
 *   Apresentação        título, chamada, resumo, etiquetas e data de atualização
 *   Resumo              números de destaque (orçamento-base, dia normal…)
 *   Plataformas         observação de cada plataforma no orçamento
 *   Metas               metas do ciclo (aceita faixas como "60–125")
 *   Conteúdo            seções de texto: Seção | Formato | Título | Texto | Etiqueta
 *   Insights            recomendações da Look
 *   qualquer outra      vira uma seção com a tabela como veio (ex.: Matriz de criativos)
 *
 * O plano é sempre mensal. Fora da aba Plano, a coluna Mês só é necessária
 * quando o arquivo tem mais de um mês.
 */
type PlanRole = "plan" | "header" | "highlights" | "platforms" | "goals" | "content" | "insights" | "ignored";

const ROLE_ALIASES: Array<[PlanRole, string[]]> = [
  ["ignored", ["instrucoes", "leia me", "leiame", "readme", "como usar", "exemplo", "modelo", "config"]],
  ["header", ["apresentacao", "cabecalho", "capa"]],
  ["highlights", ["resumo", "resumo do plano", "destaques", "numeros do plano"]],
  ["platforms", ["plataformas", "orcamento por plataforma", "verba por plataforma"]],
  ["goals", ["metas", "meta", "metas do ciclo", "metas do mes", "objetivos", "kpis"]],
  ["content", ["conteudo", "conteudos", "secoes", "textos", "blocos"]],
  ["insights", ["insights", "recomendacoes", "analise", "analises"]],
  ["plan", ["plano", "plano de midia", "campanhas", "campanha", "acoes", "veiculacao", "midia", "itens", "cronograma de campanhas"]],
];

/**
 * Nome exato (sem acento/caixa): "Plano de otimização" é uma seção de conteúdo, não
 * a aba Plano. Abas sem nome conhecido viram tabelas — ou o plano, se tiverem verba e plataforma.
 */
function classify(name: string): PlanRole | null {
  const n = normalizeText(name);
  for (const [role, aliases] of ROLE_ALIASES) if (aliases.includes(n)) return role;
  return null;
}

const PERIOD = ["mes", "periodo", "mes de referencia", "competencia", "referencia", "month"];
const BUDGET = ["verba", "investimento", "investimento previsto", "investimento planejado", "verba prevista", "verba mensal", "orcamento", "budget", "valor investido", "valor"];
const DAILY = ["diario", "verba diaria", "investimento diario", "orcamento diario", "valor diario", "por dia", "diaria"];
const PLATFORM = ["plataforma", "canal", "veiculo", "midia", "rede", "platform", "channel"];

/** Custos unitários ("Custo por lead") nunca são lidos como verba. */
const UNIT_COST = /^(custo por|custo med|custo esperado|cpl|cpa|cpc|cpm|cpr|cost per)\b/;

export interface MediaPlanNormalizeResult {
  periods: ParsedPeriod[];
  sheets: Array<{ name: string; rows: number; recognizedAs: string | null }>;
}

interface Acc {
  period: Period;
  header: NonNullable<MediaPlanDataInput["header"]> | null;
  highlights: MediaPlanFigure[];
  items: MediaPlanDataInput["items"];
  platforms: NonNullable<MediaPlanDataInput["platforms"]>;
  goals: MediaPlanFigure[];
  sections: Array<{ key: string; title: string; placement: "top" | "bottom"; blocks: MediaPlanBlock[] }>;
  insights: ParsedInsight[];
}

type Ctx = { granularity: "month"; requestedPeriod: Period | null };

const ROLE_LABEL: Record<Exclude<PlanRole, "ignored">, string> = {
  plan: "Plano",
  header: "Apresentação",
  highlights: "Resumo",
  platforms: "Plataformas",
  goals: "Metas",
  content: "Conteúdo",
  insights: "Insights",
};

export function normalizeMediaPlan(workbook: RawWorkbook, ctx: { requestedPeriod: Period | null }, issues: IssueCollector): MediaPlanNormalizeResult {
  const accs = new Map<string, Acc>();
  const acc = (p: Period): Acc => {
    const key = periodKey(p);
    let a = accs.get(key);
    if (!a) {
      a = { period: p, header: null, highlights: [], items: [], platforms: [], goals: [], sections: [], insights: [] };
      accs.set(key, a);
    }
    return a;
  };
  const periodCtx: Ctx = { granularity: "month", requestedPeriod: ctx.requestedPeriod };

  const named = workbook.sheets.map((s) => classify(s.name));
  // Sem aba "Plano" com esse nome: a tabela com verba e plataforma é o plano (ex.: primeira tabela colada sem título).
  if (!named.includes("plan")) {
    const i = workbook.sheets.findIndex((s, idx) => !named[idx] && findColumn(s.headers, BUDGET) && findColumn(s.headers, PLATFORM));
    if (i >= 0) named[i] = "plan";
  }
  const sheets: MediaPlanNormalizeResult["sheets"] = workbook.sheets.map((s, i) => ({
    name: s.name,
    rows: s.rows.length,
    recognizedAs: named[i] === "ignored" ? null : named[i] ? ROLE_LABEL[named[i] as Exclude<PlanRole, "ignored">] : `Tabela: ${s.name}`,
  }));
  if (!named.includes("plan")) {
    issues.error("missing_sheet", 'A aba "Plano" (ou "Campanhas") não foi encontrada. Ela precisa das colunas Campanha, Plataforma e Verba (ou Investimento). Confira o formato esperado ou baixe o modelo de plano de mídia.');
    return { periods: [], sheets };
  }

  // 1º as campanhas: definem os meses do arquivo. As outras abas podem dispensar a coluna Mês quando só há um.
  workbook.sheets.forEach((sheet, i) => {
    if (named[i] === "plan") readPlan(sheet, periodCtx, issues, acc);
  });
  const single = accs.size === 1 ? [...accs.values()][0].period : null;
  const restCtx: Ctx = { granularity: "month", requestedPeriod: ctx.requestedPeriod ?? single };

  workbook.sheets.forEach((sheet, i) => {
    const role = named[i];
    if (role === "plan" || role === "ignored" || role === null || !sheet.rows.length) return;
    if (role === "header") readHeader(sheet, restCtx, issues, acc);
    else if (role === "highlights" || role === "goals") readFigures(sheet, role, restCtx, issues, acc);
    else if (role === "platforms") readPlatforms(sheet, restCtx, issues, acc);
    else if (role === "content") readContent(sheet, restCtx, issues, acc);
    else if (role === "insights") readInsights(sheet, restCtx, issues, acc);
  });
  // Tabelas livres por último: assim entram no lugar marcado no Conteúdo (Formato "Tabela"), em qualquer ordem de abas.
  workbook.sheets.forEach((sheet, i) => {
    if (named[i] === null && sheet.rows.length) readFreeTable(sheet, restCtx, issues, acc);
  });
  for (const a of accs.values()) {
    for (const s of a.sections) {
      const missing = s.blocks.filter((b) => b.kind === "table" && !b.columns.length);
      for (const b of missing) issues.warn("table_not_found", `A seção "${s.title}" indica a tabela "${b.text || b.title}", mas nenhuma tabela com esse título foi enviada.`);
      s.blocks = s.blocks.filter((b) => b.kind !== "table" || b.columns.length);
    }
    a.sections = a.sections.filter((s) => s.blocks.length);
  }

  const periods: ParsedPeriod[] = [];
  for (const [key, a] of [...accs.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    if (!a.items.length) {
      issues.error("missing_items", `Há conteúdo para ${formatPeriod(a.period)}, mas nenhuma campanha na aba Plano para esse mês.`);
      continue;
    }
    const data: MediaPlanDataInput = { schemaVersion: 1, period: a.period, header: a.header, highlights: a.highlights, items: a.items, platforms: a.platforms, goals: a.goals, sections: a.sections };
    warnPlan(data, issues);
    periods.push({ periodKey: key, period: a.period, sections: ["all"], data, insights: a.insights });
  }
  return { periods, sheets };
}

/** Período de uma linha da aba Plano: coluna Mês, período do assistente ou mês da data de início. */
function planRowPeriod(sheet: RawSheet, row: RawSheet["rows"][number], periodCol: string | null, startCol: string | null, ctx: Ctx, issues: IssueCollector): Period | null {
  if (periodCol || ctx.requestedPeriod) return resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
  const start = startCol ? dateCell(row.cells[startCol]) : null;
  if (start) return monthPeriod(+start.slice(0, 4), +start.slice(5, 7));
  issues.error("missing_period", `Informe o mês do plano: selecione o período no passo anterior ou inclua a coluna "Mês" (ou "Início") na aba ${sheet.name}.`, { sheet: sheet.name, row: row.line });
  return null;
}

/** Período das demais abas: coluna Mês ou, sem ela, o único mês do arquivo / o escolhido no assistente. */
function rowPeriod(sheet: RawSheet, row: RawSheet["rows"][number], periodCol: string | null, ctx: Ctx, issues: IssueCollector): Period | null {
  if (!periodCol && !ctx.requestedPeriod) {
    issues.error("missing_period", `O arquivo tem mais de um mês: inclua a coluna "Mês" na aba ${sheet.name} para dizer a qual mês cada linha pertence.`, { sheet: sheet.name });
    return null;
  }
  return resolveRowPeriod(row.cells[periodCol ?? ""], ctx, issues, { sheet: sheet.name, line: row.line, column: periodCol });
}

function readPlan(sheet: RawSheet, ctx: Ctx, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const unitCost = h.filter((c) => UNIT_COST.test(normalizeText(c)) || c.includes("%"));
  const periodCol = findColumn(h, PERIOD);
  const dailyCol = findColumn(h, DAILY, [periodCol, ...unitCost]);
  const budgetCol = findColumn(h, BUDGET, [periodCol, dailyCol, ...unitCost]);
  const platformCol = findColumn(h, PLATFORM, [periodCol, budgetCol, dailyCol]);
  const missing = [!platformCol ? "Plataforma (ou Canal, Veículo)" : null, !budgetCol ? "Verba (ou Investimento, Orçamento)" : null].filter(Boolean);
  if (missing.length) {
    issues.error("missing_column", `A aba ${sheet.name} precisa das colunas ${missing.join(" e ")}. Colunas lidas: ${h.join(", ") || "nenhuma"}.`, { sheet: sheet.name });
    return;
  }
  const used: Array<string | null> = [periodCol, budgetCol, platformCol, dailyCol, ...unitCost.filter((c) => c.includes("%"))];
  const col = (aliases: string[]) => {
    const c = findColumn(h, aliases, used);
    if (c) used.push(c);
    return c;
  };
  const nameCol = col(["campanha", "nome da campanha", "acao", "nome", "campaign", "iniciativa"]);
  const startCol = col(["inicio", "data de inicio", "data inicial", "start"]);
  const endCol = col(["fim", "termino", "data de fim", "data final", "end"]);
  const costCol = col(["custo por resultado", "custo por resultado esperado", "custo esperado", "custo por lead", "custo por conversa", "cpl", "cpa", "cpr", "cost per result"]);
  const impressionsCol = col(["impressoes", "impressoes estimadas", "impressoes previstas", "impressions"]);
  const reachCol = col(["alcance", "alcance estimado", "alcance previsto", "reach"]);
  const clicksCol = col(["cliques", "cliques estimados", "cliques previstos", "clicks"]);
  // Meta numérica e tipo de resultado: "Meta de leads" já diz o tipo; "Resultado esperado" pode ser número ou texto.
  const targetCol = col(["meta", "meta de resultados", "resultados esperados", "resultado esperado", "quantidade esperada", "volume esperado", "resultados previstos", "resultados", "meta de leads", "leads esperados"]);
  const typeCol = col(["tipo de resultado", "kpi", "metrica", "indicador", "resultado"]);
  const objectiveCol = col(["objetivo", "objective"]);
  const funnelCol = col(["funil", "etapa do funil", "etapa", "funnel"]);
  const audienceCol = col(["publico", "publico alvo", "segmentacao", "audiencia", "praca", "audience"]);
  const offersCol = col(["ofertas", "oferta", "servicos", "produtos", "procedimentos"]);
  const formatCol = col(["formato", "formatos", "criativo", "criativos", "format", "pecas"]);
  const notesCol = col(["observacoes", "observacao", "obs", "notas", "detalhes", "comentarios"]);
  const headerResidual = targetCol ? targetCol.replace(/\b(meta|metas|resultados?|quantidade|volume|esperad[oa]s?|previst[oa]s?|de|do|da)\b/gi, "").replace(/\s+/g, " ").trim() : "";
  const headerType = headerResidual ? mapResultType(headerResidual) : null;

  const ids = new Set<string>();
  const outside: string[] = [];
  for (const row of sheet.rows) {
    const platformText = textCell(row.cells[platformCol!]);
    const name = nameCol ? textCell(row.cells[nameCol]) : null;
    if (isTotalLabel(platformText) || isTotalLabel(name)) continue;
    const budgetCell = numberCell(row.cells[budgetCol!]);
    if (!platformText && !name && budgetCell.value === null) continue;
    const where = { sheet: sheet.name, row: row.line };
    if (!platformText) {
      issues.error("missing_value", `Informe a plataforma ou o veículo (aba ${sheet.name}, linha ${row.line}).`, { ...where, column: platformCol! });
      continue;
    }
    if (budgetCell.invalid || budgetCell.value === null || budgetCell.value < 0) {
      issues.error("invalid_number", `A verba ${budgetCell.value === null && !budgetCell.invalid ? "precisa ser preenchida" : "não é um número válido"} (aba ${sheet.name}, linha ${row.line}).`, { ...where, column: budgetCol! });
      continue;
    }
    const period = planRowPeriod(sheet, row, periodCol, startCol, ctx, issues);
    if (!period) continue;
    const read = (c: string | null) => {
      if (!c) return null;
      const n = numberCell(row.cells[c]);
      if (n.invalid) issues.error("invalid_number", `O valor de "${c}" não é um número (aba ${sheet.name}, linha ${row.line}).`, { ...where, column: c });
      return n.value === null ? null : Math.abs(n.value);
    };
    const text = (c: string | null, max = 300) => (c ? (textCell(row.cells[c])?.slice(0, max) ?? null) : null);
    const start = readDate(row.cells[startCol ?? ""], startCol, sheet.name, row.line, issues);
    const end = readDate(row.cells[endCol ?? ""], endCol, sheet.name, row.line, issues);
    if (start && end && start > end) {
      issues.error("invalid_period", `A data de início é posterior à de fim (aba ${sheet.name}, linha ${row.line}).`, where);
      continue;
    }
    if ((start && start > period.end) || (end && end < period.start)) outside.push(`linha ${row.line}`);

    const targetRaw = targetCol ? row.cells[targetCol] : null;
    const targetIsText = typeof targetRaw === "string" && targetRaw.trim() !== "" && numberCell(targetRaw).invalid;
    const typeText = (typeCol ? textCell(row.cells[typeCol]) : null) ?? (targetIsText ? textCell(targetRaw) : null);
    const mapped = typeText ? mapResultType(typeText) : headerType;
    const platform = mapPlatform(platformText) ?? platformText;
    const label = name ?? platformText;
    let id = slugify(`${platform}-${label}`) || `linha-${row.line}`;
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);

    acc(period).items.push({
      id,
      platform,
      name: label,
      objective: text(objectiveCol),
      funnel: text(funnelCol, 80),
      audience: text(audienceCol, 500),
      offers: text(offersCol, 500),
      format: text(formatCol),
      start,
      end,
      budget: budgetCell.value,
      dailyBudget: read(dailyCol),
      resultType: mapped?.type ?? (typeText ? "other" : null),
      resultLabel: mapped?.type ? (mapped.label ?? null) : typeText ? typeText.slice(0, 60) : null,
      resultTarget: targetIsText ? null : read(targetCol),
      costPerResultTarget: read(costCol),
      impressionsTarget: read(impressionsCol),
      reachTarget: read(reachCol),
      clicksTarget: read(clicksCol),
      notes: text(notesCol, 1000),
    });
  }
  if (outside.length) issues.warn("plan_dates_outside", `Algumas linhas da aba ${sheet.name} têm datas fora do mês do plano (${outside.slice(0, 4).join(", ")}${outside.length > 4 ? ", …" : ""}). Confira as colunas Início e Fim.`, { sheet: sheet.name });
}

function readDate(value: CellValue | undefined, column: string | null, sheet: string, line: number, issues: IssueCollector): string | null {
  if (!column || value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^[-–—\s]+$/.test(value)) return null;
  const iso = dateCell(value);
  if (!iso) issues.error("invalid_date", `A data "${String(value).slice(0, 30)}" na coluna ${column} (aba ${sheet}, linha ${line}) não é válida. Use, por exemplo, 01/10/2026.`, { sheet, row: line, column });
  return iso;
}

/**
 * Apresentação: colunas (Título | Chamada | Resumo | Etiquetas | Atualizado em) ou
 * pares Campo | Valor. Etiquetas separadas por ponto e vírgula.
 */
function readHeader(sheet: RawSheet, ctx: Ctx, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const fieldCol = findColumn(h, ["campo", "item", "informacao"], [periodCol]);
  const valueCol = fieldCol ? findColumn(h, ["valor", "conteudo", "texto"], [periodCol, fieldCol]) : null;
  const FIELDS = {
    title: ["titulo", "title", "nome do plano"],
    tagline: ["chamada", "subtitulo", "linha fina", "tema", "eyebrow"],
    summary: ["resumo", "descricao", "texto", "apresentacao", "subtitulo do plano"],
    tags: ["etiquetas", "tags", "chips", "selos"],
    updatedAt: ["atualizado em", "atualizacao", "data de atualizacao", "atualizado", "data"],
  } as const;
  type Field = keyof typeof FIELDS;
  const fieldOf = (label: string): Field | null => {
    const n = normalizeText(label);
    return (Object.keys(FIELDS) as Field[]).find((f) => FIELDS[f].some((a) => n === a || n.startsWith(`${a} `))) ?? null;
  };
  const apply = (period: Period, field: Field, raw: CellValue, line: number) => {
    const a = acc(period);
    const header = a.header ?? { title: null, tagline: null, summary: null, tags: [], updatedAt: null };
    const value = textCell(raw);
    if (!value) return;
    if (field === "tags") header.tags = [...(header.tags ?? []), ...value.split(/\s*[;\n]\s*/).map((t) => t.trim().slice(0, 60)).filter(Boolean)].slice(0, 8);
    else if (field === "updatedAt") {
      const iso = dateCell(raw);
      if (iso) header.updatedAt = iso;
      else issues.warn("invalid_date", `A data de atualização "${value.slice(0, 30)}" (aba ${sheet.name}, linha ${line}) não foi reconhecida e ficou de fora.`, { sheet: sheet.name, row: line });
    } else header[field] = value.slice(0, field === "summary" ? 1500 : 160);
    a.header = header;
  };

  if (fieldCol && valueCol) {
    for (const row of sheet.rows) {
      const field = fieldOf(textCell(row.cells[fieldCol]) ?? "");
      if (!field) continue;
      const period = rowPeriod(sheet, row, periodCol, ctx, issues);
      if (period) apply(period, field, row.cells[valueCol], row.line);
    }
    return;
  }
  const columns = h.filter((c) => c !== periodCol).map((c) => [c, fieldOf(c)] as const).filter((x): x is readonly [string, Field] => x[1] !== null);
  if (!columns.length) return issues.error("missing_column", `A aba ${sheet.name} precisa das colunas Título, Chamada, Resumo, Etiquetas ou Atualizado em (ou das colunas Campo e Valor).`, { sheet: sheet.name });
  for (const row of sheet.rows) {
    const period = rowPeriod(sheet, row, periodCol, ctx, issues);
    if (!period) continue;
    for (const [c, field] of columns) apply(period, field, row.cells[c], row.line);
  }
}

/** Resumo e Metas: Indicador | Valor | Descrição. Valores que não são um número só ("60–125") ficam como texto. */
function readFigures(sheet: RawSheet, role: "highlights" | "goals", ctx: Ctx, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const nameCol = findColumn(h, ["indicador", "meta", "metrica", "nome", "item", "titulo", "kpi", "destaque"], [periodCol]);
  const valueCol = findColumn(h, ["valor", "meta numerica", "quantidade", "total", "value", "alvo", "numero"], [periodCol, nameCol]);
  if (!nameCol || !valueCol) return issues.error("missing_column", `A aba ${sheet.name} precisa das colunas "Indicador" (ou Meta, Nome) e "Valor".`, { sheet: sheet.name });
  const formatCol = findColumn(h, ["formato", "tipo", "format"], [nameCol, valueCol]);
  const descCol = findColumn(h, ["descricao", "observacao", "nota", "detalhe", "explicacao", "obs", "description"], [nameCol, valueCol, formatCol]);
  for (const row of sheet.rows) {
    const label = textCell(row.cells[nameCol]);
    if (!label || isTotalLabel(label)) continue;
    const period = rowPeriod(sheet, row, periodCol, ctx, issues);
    if (!period) continue;
    const raw = row.cells[valueCol];
    const asText = typeof raw === "string" ? raw.trim() : null;
    const n = numberCell(raw);
    const fmtText = normalizeText(formatCol ? (textCell(row.cells[formatCol]) ?? "") : "");
    const looksCurrency = Boolean(asText && /r\$|us\$|€/i.test(asText));
    const looksPercent = Boolean(asText?.includes("%"));
    const format = /moeda|real|r\$|currency|valor|custo/.test(fmtText) || looksCurrency ? "currency" : /percent|%|taxa/.test(fmtText) || looksPercent ? "percent" : /decimal/.test(fmtText) ? "decimal" : "integer";
    const value = n.invalid ? null : format === "percent" && n.value !== null && Math.abs(n.value) > 1 ? n.value / 100 : n.value;
    // Mantém o texto como foi escrito (moeda sem centavos, faixas, "≥ 30%"); números puros são formatados pelo portal.
    const display = asText && (n.invalid || /[^\d.,\s-]/.test(asText)) ? asText.slice(0, 60) : null;
    if (value === null && !display) continue;
    const a = acc(period);
    const list = role === "goals" ? a.goals : a.highlights;
    let key = slugify(label) || `indicador-${row.line}`;
    while (list.some((g) => g.key === key)) key = `${key}-2`;
    list.push({ key, label: label.slice(0, 120), value, display, format, description: descCol ? (textCell(row.cells[descCol])?.slice(0, 300) ?? null) : null });
  }
}

function readPlatforms(sheet: RawSheet, ctx: Ctx, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const platformCol = findColumn(h, PLATFORM, [periodCol]);
  const descCol = findColumn(h, ["descricao", "observacao", "observacoes", "nota", "detalhe", "texto"], [periodCol, platformCol]);
  if (!platformCol || !descCol) return issues.error("missing_column", `A aba ${sheet.name} precisa das colunas Plataforma e Descrição.`, { sheet: sheet.name });
  for (const row of sheet.rows) {
    const name = textCell(row.cells[platformCol]);
    const description = textCell(row.cells[descCol]);
    if (!name || !description) continue;
    const period = rowPeriod(sheet, row, periodCol, ctx, issues);
    if (!period) continue;
    const platform = mapPlatform(name) ?? name;
    const a = acc(period);
    a.platforms = [...a.platforms.filter((p) => p.platform !== platform), { platform, description: description.slice(0, 500) }];
  }
}

const BLOCK_ALIASES: Array<[MediaPlanBlock["kind"], RegExp]> = [
  ["table", /^(tabela|table|quadro)/],
  ["callout", /^(destaque|aviso|callout|nota|observacao|importante)/],
  ["card", /^(cartao|cartoes|card|bloco)/],
  ["step", /^(passo|passos|etapa|etapas|numerado)/],
  ["item", /^(item|itens|lista|topico|bullet|marcador)/],
  ["quote", /^(mensagem|citacao|script|roteiro|frase)/],
  ["warning", /^(alerta|atencao|compliance|regra|restricao|cuidado)/],
  ["phase", /^(fase|fases|cronograma|timeline|linha do tempo)/],
  ["text", /^(texto|paragrafo|descricao)/],
];

function sectionOf(a: Acc, title: string, placement: "top" | "bottom" | null) {
  const key = slugify(title) || "secao";
  let s = a.sections.find((x) => x.key === key);
  if (!s) {
    s = { key, title: title.slice(0, 140), placement: placement ?? "bottom", blocks: [] };
    a.sections.push(s);
  } else if (placement) s.placement = placement;
  return s;
}

/**
 * Conteúdo: Seção | Formato | Título | Texto | Etiqueta | Posição — uma linha por bloco,
 * na ordem do arquivo. Formato "Tabela" marca onde entra a tabela de mesmo título (no Texto).
 */
function readContent(sheet: RawSheet, ctx: Ctx, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const sectionCol = findColumn(h, ["secao", "sessao", "grupo", "bloco"], [periodCol]);
  const kindCol = findColumn(h, ["formato", "tipo", "estilo"], [periodCol, sectionCol]);
  const titleCol = findColumn(h, ["titulo", "title", "nome", "subtitulo"], [periodCol, sectionCol, kindCol]);
  const textCol = findColumn(h, ["texto", "descricao", "conteudo", "detalhe", "text"], [periodCol, sectionCol, kindCol, titleCol]);
  const tagCol = findColumn(h, ["etiqueta", "tag", "selo", "badge", "destaque"], [periodCol, sectionCol, kindCol, titleCol, textCol]);
  const placeCol = findColumn(h, ["posicao", "local", "lugar"], [periodCol, sectionCol, kindCol, titleCol, textCol, tagCol]);
  if (!sectionCol || !textCol) return issues.error("missing_column", `A aba ${sheet.name} precisa das colunas Seção e Texto (e, opcionalmente, Formato, Título e Etiqueta).`, { sheet: sheet.name });
  for (const row of sheet.rows) {
    const section = textCell(row.cells[sectionCol]);
    const title = titleCol ? textCell(row.cells[titleCol]) : null;
    const text = textCell(row.cells[textCol]);
    if (!section || (!text && !title)) continue;
    const period = rowPeriod(sheet, row, periodCol, ctx, issues);
    if (!period) continue;
    const kindText = normalizeText(kindCol ? (textCell(row.cells[kindCol]) ?? "") : "");
    const kind = kindText ? (BLOCK_ALIASES.find(([, re]) => re.test(kindText))?.[0] ?? null) : "text";
    if (!kind) issues.warn("unknown_block", `O formato "${textCell(row.cells[kindCol!])}" (aba ${sheet.name}, linha ${row.line}) não foi reconhecido e o bloco foi exibido como texto.`, { sheet: sheet.name, row: row.line });
    const place = normalizeText(placeCol ? (textCell(row.cells[placeCol]) ?? "") : "");
    const placement = /^(topo|inicio|antes|acima|primeiro)/.test(place) ? "top" : place ? "bottom" : null;
    sectionOf(acc(period), section, placement).blocks.push({
      kind: kind ?? "text",
      title: title?.slice(0, 200) ?? null,
      text: (text ?? "").slice(0, 3000),
      tag: tagCol ? (textCell(row.cells[tagCol])?.slice(0, 60) ?? null) : null,
      columns: [],
      rows: [],
    });
  }
}

/** Qualquer outra tabela vira uma seção com a tabela como veio (ex.: "Matriz de criativos", "Cenários"). */
function readFreeTable(sheet: RawSheet, ctx: Ctx, issues: IssueCollector, acc: (p: Period) => Acc) {
  const periodCol = findColumn(sheet.headers, PERIOD);
  const columns = sheet.headers.filter((c) => c !== periodCol);
  if (!columns.length) return;
  const byPeriod = new Map<string, { period: Period; rows: string[][] }>();
  for (const row of sheet.rows) {
    const cells = columns.map((c) => cellText(row.cells[c]));
    if (cells.every((c) => !c)) continue;
    const period = rowPeriod(sheet, row, periodCol, ctx, issues);
    if (!period) continue;
    const key = periodKey(period);
    const entry = byPeriod.get(key) ?? { period, rows: [] };
    entry.rows.push(cells.map((c) => c.slice(0, 500)));
    byPeriod.set(key, entry);
  }
  const name = normalizeText(sheet.name);
  for (const { period, rows } of byPeriod.values()) {
    const table: MediaPlanBlock = { kind: "table", title: null, text: "", tag: null, columns: columns.map((c) => c.slice(0, 80)), rows };
    const a = acc(period);
    // 1º o lugar marcado no Conteúdo; senão, a seção de mesmo nome (ou uma nova, no fim).
    const slot = a.sections.flatMap((s) => s.blocks).find((b) => b.kind === "table" && !b.columns.length && normalizeText(b.text || b.title || "") === name);
    if (slot) Object.assign(slot, { columns: table.columns, rows: table.rows, title: null, text: "" });
    else sectionOf(a, sheet.name, null).blocks.push(table);
  }
}

function cellText(v: CellValue | undefined): string {
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return textCell(v ?? null) ?? "";
}

function readInsights(sheet: RawSheet, ctx: Ctx, issues: IssueCollector, acc: (p: Period) => Acc) {
  const h = sheet.headers;
  const periodCol = findColumn(h, PERIOD);
  const titleCol = findColumn(h, ["titulo", "title", "destaque", "recomendacao"]);
  const descCol = findColumn(h, ["descricao", "texto", "description", "detalhe", "comentario"], [titleCol]);
  const typeCol = findColumn(h, ["tipo", "categoria", "type"], [titleCol, descCol]);
  if (!titleCol) return issues.error("missing_column", 'A coluna "Título" não foi encontrada na aba Insights.', { sheet: sheet.name, column: "Título" });
  for (const row of sheet.rows) {
    const title = textCell(row.cells[titleCol]);
    if (!title) continue;
    const period = rowPeriod(sheet, row, periodCol, ctx, issues);
    if (!period) continue;
    acc(period).insights.push({ type: mapInsightType(typeCol ? textCell(row.cells[typeCol]) : "recomendação"), title: title.slice(0, 140), description: (descCol ? (textCell(row.cells[descCol]) ?? "") : "").slice(0, 1500) });
  }
}

/** Avisos que não impedem a importação. */
function warnPlan(data: MediaPlanDataInput, issues: IssueCollector) {
  const label = formatPeriod(data.period);
  const total = data.items.reduce((s, i) => s + i.budget, 0);
  if (total === 0) issues.warn("plan_zero_budget", `O plano de ${label} está com verba total zero.`);
  const planned = new Set(data.items.map((i) => i.platform));
  const orphan = (data.platforms ?? []).filter((p) => !planned.has(p.platform));
  if (orphan.length) issues.warn("platform_without_items", `A aba Plataformas fala de ${orphan.map((p) => p.platform).join(", ")}, mas nenhuma campanha de ${label} usa ${orphan.length === 1 ? "essa plataforma" : "essas plataformas"}.`);
}
