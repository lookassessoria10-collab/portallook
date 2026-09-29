import "server-only";
import { env } from "@/lib/env";
import { createId, normalizeText } from "@/lib/ids";
import { NotFoundError, UserFacingError, logError } from "@/lib/errors";
import { formatCurrency, formatInteger } from "@/lib/format/number";
import { formatPeriod, periodKey, type Period } from "@/lib/dates/period";
import { paths } from "@/lib/storage/paths";
import { getStorage } from "@/lib/storage";
import { readJSON, writeJSON } from "@/lib/storage/json";
import { EXTENSION_FORMAT, extensionOf, sanitizeDisplayName, sniffFormat } from "@/lib/parsers/sniff";
import { readExcel } from "@/lib/parsers/xlsx";
import { readCsv } from "@/lib/parsers/csv";
import { inspectPdf } from "@/lib/parsers/pdf";
import { inspectHtml } from "@/lib/parsers/html";
import { FileReadError, type RawWorkbook } from "@/lib/parsers/types";
import { logEvent } from "@/features/events/service";
import { getClient } from "@/features/clients/service";
import { upsertImportEntry } from "@/features/reports/index-entry";
import { createDraftReport, getReportData, getReportManifest, newInsightId, type ReportData } from "@/features/reports/service";
import type { ImportIndexEntry, Insight, ReportIndexEntry, ReportManifest, ReportType, SourceType } from "@/features/reports/schema";
import { computeCommercialMetrics } from "@/features/commercial/metrics";
import { normalizeCommercial, type SheetRole } from "@/features/commercial/normalize";
import { CommercialDataSchema, type CommercialData } from "@/features/commercial/schema";
import { buildTrafficView } from "@/features/traffic/metrics";
import { normalizeTraffic } from "@/features/traffic/normalize";
import { TrafficDataSchema } from "@/features/traffic/schema";
import { getRepositories } from "@/server/repositories";
import { IssueCollector } from "./issues";
import { ParsedImportSchema, type ParsedImport, type ParsedPeriod } from "./parsed";
import type { CsvContent, FileFormat, ImportPreview, ImportRecord, PreviewPeriod } from "./schema";

const CONTENT_TYPES: Record<FileFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  pdf: "application/pdf",
  html: "text/html",
};

/** MIME declarado pelo navegador precisa ser compatível (quando informado). */
const ALLOWED_MIME: Record<FileFormat, RegExp> = {
  xlsx: /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream|application\/zip|)$/,
  xls: /^(application\/vnd\.ms-excel|application\/octet-stream|application\/x-msexcel|)$/,
  csv: /^(text\/csv|text\/plain|application\/vnd\.ms-excel|application\/csv|text\/x-csv|application\/octet-stream|)$/,
  pdf: /^(application\/pdf|application\/x-pdf|application\/octet-stream|)$/,
  html: /^(text\/html|application\/xhtml\+xml|text\/plain|application\/octet-stream|)$/,
};

export function uploadLimits() {
  const e = env();
  return { maxBytes: Math.round(e.UPLOAD_MAX_MB * 1024 * 1024), serverMaxBytes: Math.round(e.SERVER_UPLOAD_MAX_MB * 1024 * 1024) };
}

function toIndexEntry(r: ImportRecord): ImportIndexEntry {
  return {
    id: r.id,
    reportType: r.reportType,
    fileName: r.fileName,
    format: r.format,
    status: r.status,
    periodKey: r.requestedPeriod ? periodKey(r.requestedPeriod) : null,
    errorCount: r.issues.filter((i) => i.level === "error").length,
    warningCount: r.issues.filter((i) => i.level === "warning").length,
    reportIds: r.reportIds,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function syncIndex(record: ImportRecord) {
  const now = new Date().toISOString();
  await getRepositories().reports.updateIndex(record.clientId, (index) => upsertImportEntry(index, toIndexEntry(record), now));
}

async function saveRecord(record: ImportRecord): Promise<ImportRecord> {
  const saved = await getRepositories().imports.save({ ...record, updatedAt: new Date().toISOString() });
  await syncIndex(saved);
  return saved;
}

export async function requireImport(importId: string): Promise<ImportRecord> {
  const record = await getRepositories().imports.get(importId);
  if (!record) throw new NotFoundError("Importação não encontrada.");
  return record;
}

export interface InitImportInput {
  clientId: string;
  reportType: ReportType;
  fileName: string;
  size: number;
  contentType: string;
  csvContent?: CsvContent | null;
  csvDimensionLabel?: string | null;
  period?: Period | null;
  title?: string | null;
  allowDownload?: boolean;
}

export interface InitImportResult {
  importId: string;
  strategy: "server" | "blob";
  pathname: string;
  maxBytes: number;
}

/** Etapa 1: valida metadados (extensão, tamanho, nome, cliente) e reserva o registro. */
export async function initImport(input: InitImportInput): Promise<InitImportResult> {
  const client = await getClient(input.clientId);
  if (!client) throw new UserFacingError("Cliente não encontrado.");
  if (client.status !== "active") throw new UserFacingError("Este cliente está inativo. Reative-o para enviar relatórios.");
  if (!client.modules[input.reportType].enabled) throw new UserFacingError(`O módulo ${input.reportType === "commercial" ? "Comercial" : "Tráfego"} não está ativo para este cliente.`);

  const fileName = sanitizeDisplayName(input.fileName);
  const format = EXTENSION_FORMAT[extensionOf(fileName)];
  if (!format) throw new UserFacingError("Formato não aceito. Envie XLSX, XLS, CSV, PDF ou HTML.");
  const mime = (input.contentType || "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MIME[format].test(mime)) throw new UserFacingError("O tipo do arquivo não corresponde à extensão. Verifique se o arquivo está correto.");

  const { maxBytes, serverMaxBytes } = uploadLimits();
  if (!Number.isFinite(input.size) || input.size <= 0) throw new UserFacingError("O arquivo está vazio.");
  if (input.size > maxBytes) throw new UserFacingError(`O arquivo tem ${(input.size / 1024 / 1024).toFixed(1)} MB. O limite é ${env().UPLOAD_MAX_MB} MB.`);

  if (format === "csv") {
    if (!input.csvContent) throw new UserFacingError("Informe o tipo de conteúdo do CSV (funil, financeiro, canais…).");
    const isTraffic = input.csvContent === "traffic";
    if (isTraffic !== (input.reportType === "traffic")) throw new UserFacingError("O conteúdo escolhido para o CSV não corresponde ao tipo de relatório.");
    if (input.csvContent === "dimension" && !input.csvDimensionLabel?.trim()) throw new UserFacingError("Informe o nome da dimensão (ex.: Serviços, Profissionais).");
  }
  // HTML estruturado traz o próprio período; HTML legado sem período é recusado na validação.
  if (format === "pdf" && !input.period) {
    throw new UserFacingError("Selecione o período do relatório antes de enviar um PDF.");
  }

  const id = createId("im");
  const ext = format === "html" ? "html" : format;
  const stagingPath = paths.importOriginal(id, ext);
  const now = new Date().toISOString();
  await saveRecord({
    id,
    clientId: client.id,
    reportType: input.reportType,
    format,
    fileName,
    size: input.size,
    contentType: CONTENT_TYPES[format],
    stagingPath,
    status: "awaiting_file",
    csvContent: format === "csv" ? (input.csvContent ?? null) : null,
    csvDimensionLabel: input.csvContent === "dimension" ? (input.csvDimensionLabel?.trim().slice(0, 60) ?? null) : null,
    requestedPeriod: input.period ?? null,
    title: input.title?.trim().slice(0, 160) || null,
    allowDownload: input.allowDownload ?? client.modules[input.reportType].allowOriginalDownload,
    issues: [],
    preview: null,
    parsedPath: null,
    reportIds: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });

  const storage = getStorage();
  const strategy = storage.supportsDirectUpload && input.size > serverMaxBytes ? "blob" : "server";
  return { importId: id, strategy, pathname: stagingPath, maxBytes };
}

/** Upload pelo servidor (arquivos pequenos ou driver local). */
export async function receiveFile(importId: string, body: Buffer) {
  const record = await requireImport(importId);
  if (record.status !== "awaiting_file") throw new UserFacingError("Este upload já foi recebido.");
  if (body.length === 0) throw new UserFacingError("O arquivo chegou vazio. Tente novamente.");
  if (body.length > uploadLimits().maxBytes) throw new UserFacingError("O arquivo excede o tamanho máximo permitido.");
  await getRepositories().imports.putFile(record.stagingPath, body, record.contentType);
  await saveRecord({ ...record, status: "uploaded", size: body.length });
  await logEvent("upload.received", { clientId: record.clientId, summary: `Arquivo ${record.fileName} recebido.`, meta: { importId } });
}

function csvRole(content: CsvContent): SheetRole {
  const map: Record<Exclude<CsvContent, "traffic">, SheetRole> = { funnel: "funnel", financial: "financial", channels: "channels", insights: "insights", dimension: "dimension" };
  return map[content as Exclude<CsvContent, "traffic">];
}

const CSV_SHEET_NAME: Record<CsvContent, string> = { funnel: "Funil", financial: "Financeiro", channels: "Canais", insights: "Insights", dimension: "Dimensão", traffic: "Campanhas" };

/**
 * Etapa 2: lê o arquivo, valida conteúdo (assinatura, colunas, períodos),
 * normaliza e monta a prévia. Nada é publicado aqui.
 */
export async function processImport(importId: string): Promise<ImportRecord> {
  let record = await requireImport(importId);
  if (!["awaiting_file", "uploaded", "validated", "invalid"].includes(record.status)) throw new UserFacingError("Esta importação já foi concluída ou descartada.");
  const repos = getRepositories();
  const body = await repos.imports.getFile(record.stagingPath);
  if (!body) {
    if (record.status === "awaiting_file") throw new UserFacingError("O arquivo ainda não chegou ao servidor. Aguarde o fim do envio e tente novamente.");
    throw new UserFacingError("O arquivo enviado não foi encontrado. Envie novamente.");
  }
  const client = await getClient(record.clientId);
  if (!client) throw new UserFacingError("Cliente não encontrado.");

  const issues = new IssueCollector();
  let parsed: ParsedImport | null = null;
  let sheets: ImportPreview["sheets"] = [];
  let documentPages: number | null = null;

  try {
    const sniffed = sniffFormat(body);
    const expected = record.format;
    const compatible = sniffed === expected || (expected === "csv" && sniffed === "csv") || (expected === "xls" && (sniffed === "xls" || sniffed === "xlsx"));
    if (!compatible) {
      issues.error("content_mismatch", sniffed === "unknown" ? "O conteúdo do arquivo não pôde ser reconhecido. Ele pode estar corrompido." : `O arquivo tem extensão .${expected}, mas o conteúdo parece ser ${sniffed.toUpperCase()}. Salve no formato correto e envie novamente.`);
    } else {
      const granularity = client.modules[record.reportType].cadence === "weekly" ? "week" : "month";
      const periodCtx = { granularity, requestedPeriod: record.requestedPeriod } as const;

      if (expected === "pdf") {
        const info = inspectPdf(body);
        documentPages = info.pages;
        if (info.encrypted) issues.warn("pdf_encrypted", "O PDF parece protegido por senha ou restrições. Ele pode não abrir no visualizador.");
        if (!info.complete) issues.warn("pdf_incomplete", "O PDF pode estar incompleto (fim do arquivo não encontrado). Confira a prévia.");
        if (!record.requestedPeriod) issues.error("missing_period", "Selecione o período deste relatório.");
        else parsed = { kind: "document", reportType: record.reportType, sourceType: "pdf", period: record.requestedPeriod, title: record.title, pages: info.pages };
      } else if (expected === "html") {
        const html = inspectHtml(body);
        if (html.kind === "structured") {
          parsed = parseStructuredHtml(html.payload, record, [client.slug, client.name, client.shortName], issues);
        } else {
          if (!record.requestedPeriod) issues.error("missing_period", "Este HTML não tem dados estruturados do Portal Look, então será exibido como documento. Volte e selecione o período do relatório.");
          else parsed = { kind: "document", reportType: record.reportType, sourceType: "html_legacy", period: record.requestedPeriod, title: record.title ?? html.title, pages: null };
        }
      } else {
        const workbook: RawWorkbook = expected === "csv" ? readCsv(body, CSV_SHEET_NAME[record.csvContent ?? "funnel"]) : readExcel(body, sniffed === "xlsx" ? "xlsx" : "xls");
        if (record.reportType === "commercial") {
          const result = normalizeCommercial(workbook, { ...periodCtx, csvRole: record.csvContent ? csvRole(record.csvContent) : undefined, csvDimensionLabel: record.csvDimensionLabel }, issues);
          sheets = result.sheets;
          parsed = { kind: "dataset", reportType: "commercial", sourceType: expected, partial: Boolean(record.csvContent), periods: result.periods };
        } else {
          const result = normalizeTraffic(workbook, { ...periodCtx, clientNames: [client.name, client.shortName, client.slug], csv: expected === "csv" }, issues);
          sheets = result.sheets;
          parsed = { kind: "dataset", reportType: "traffic", sourceType: expected, partial: false, periods: result.periods };
        }
        if (parsed.kind === "dataset" && !parsed.periods.length && !issues.hasErrors) issues.error("empty", "Nenhum dado foi encontrado no arquivo.");
      }
    }
  } catch (e) {
    if (e instanceof FileReadError || e instanceof UserFacingError) issues.error("read_error", e.message);
    else {
      logError("import:process", e, { importId });
      issues.error("read_error", "Não foi possível ler este arquivo. Verifique se ele não está corrompido e tente novamente.");
    }
  }

  // Validação final contra o schema — nunca deixa passar dado inconsistente.
  if (parsed?.kind === "dataset" && !parsed.partial) {
    for (const p of parsed.periods) {
      const schema = parsed.reportType === "commercial" ? CommercialDataSchema : TrafficDataSchema;
      const check = schema.safeParse(p.data);
      if (!check.success) issues.error("invalid_data", `Os dados de ${formatPeriod(p.period)} estão incompletos: ${check.error.issues[0]?.message ?? "verifique as colunas obrigatórias"}.`);
      else p.data = check.data;
    }
  }

  const index = await repos.reports.getIndex(record.clientId);
  const preview = parsed ? buildPreview(parsed, index.reports, record, sheets, documentPages, issues) : null;

  let parsedPath: string | null = null;
  if (parsed && !issues.hasErrors) {
    parsedPath = paths.importParsed(record.id);
    await writeJSON(getStorage(), parsedPath, parsed);
  }

  const status = issues.hasErrors ? "invalid" : "validated";
  record = await saveRecord({ ...record, status, issues: issues.items, preview, parsedPath });
  if (status === "invalid") {
    await logEvent("import.failed", { clientId: record.clientId, summary: `Erro ao importar ${record.fileName}: ${issues.errors[0]?.message ?? ""}`.slice(0, 280), meta: { importId } });
  }
  return record;
}

function parseStructuredHtml(payload: unknown, record: ImportRecord, clientNames: string[], issues: IssueCollector): ParsedImport | null {
  const obj = (payload ?? {}) as { type?: string; client?: string; data?: unknown; insights?: Array<{ type?: string; title?: string; description?: string }> };
  const type = obj.type === "traffic" || obj.type === "trafego" ? "traffic" : obj.type === "commercial" || obj.type === "comercial" ? "commercial" : null;
  if (!type) {
    issues.error("invalid_structure", 'O HTML estruturado precisa informar "type": "commercial" ou "traffic".');
    return null;
  }
  if (type !== record.reportType) {
    issues.error("type_mismatch", `Este HTML contém dados de ${type === "traffic" ? "tráfego" : "comercial"}, mas o relatório escolhido é ${record.reportType === "traffic" ? "tráfego" : "comercial"}.`);
    return null;
  }
  const schema = type === "commercial" ? CommercialDataSchema : TrafficDataSchema;
  const check = schema.safeParse(obj.data);
  if (!check.success) {
    issues.error("invalid_structure", `Os dados do HTML estruturado não seguem o formato do Portal Look (${check.error.issues[0]?.path.join(".") || "raiz"}: ${check.error.issues[0]?.message}).`);
    return null;
  }
  if (obj.client && !clientNames.some((n) => normalizeText(n) === normalizeText(String(obj.client)))) {
    issues.error("client_mismatch", `Este HTML é do cliente "${String(obj.client).slice(0, 60)}", que não corresponde ao cliente selecionado.`);
    return null;
  }
  const data = check.data as { period: Period };
  return {
    kind: "dataset",
    reportType: type,
    sourceType: "html_structured",
    partial: false,
    periods: [
      {
        periodKey: periodKey(data.period),
        period: data.period,
        sections: ["all"],
        data: check.data,
        insights: (obj.insights ?? [])
          .filter((i) => i.title)
          .map((i) => ({ type: i.type === "positive" || i.type === "attention" || i.type === "recommendation" ? i.type : "neutral", title: String(i.title).slice(0, 140), description: String(i.description ?? "").slice(0, 1500) })),
      },
    ],
  };
}

function periodMetrics(reportType: ReportType, p: ParsedPeriod): { metrics: PreviewPeriod["metrics"]; details: string[] } {
  if (reportType === "commercial") {
    const parsed = CommercialDataSchema.safeParse(p.data);
    if (!parsed.success) {
      const partial = p.data as Partial<CommercialData>;
      return { metrics: [], details: [`Seções: ${p.sections.join(", ")}`, `${partial.channels?.length ?? 0} canais`] };
    }
    const m = computeCommercialMetrics(parsed.data);
    const metrics: PreviewPeriod["metrics"] = m.stages.map((s) => ({ label: s.label, value: s.value === null ? "não registrado" : formatInteger(s.value) }));
    if (m.revenue !== null) metrics.push({ label: "Receita", value: formatCurrency(m.revenue) });
    if (m.investment !== null) metrics.push({ label: "Investimento", value: formatCurrency(m.investment) });
    const details = [
      `${parsed.data.channels.length} canal(is)`,
      ...parsed.data.dimensions.map((d) => `${d.label}: ${d.rows.length} item(ns)`),
      ...(parsed.data.extraMetrics.length ? [`${parsed.data.extraMetrics.length} indicador(es) adicional(is)`] : []),
      ...(p.insights.length ? [`${p.insights.length} insight(s)`] : []),
    ];
    return { metrics, details };
  }
  const parsed = TrafficDataSchema.safeParse(p.data);
  if (!parsed.success) return { metrics: [], details: [] };
  const v = buildTrafficView(parsed.data);
  const metrics: PreviewPeriod["metrics"] = [
    { label: "Investimento", value: formatCurrency(v.totals.investment) },
    { label: "Impressões", value: formatInteger(v.totals.impressions) },
  ];
  if (v.totals.results !== null) metrics.push({ label: "Resultados", value: formatInteger(v.totals.results) });
  if (v.totals.clicks !== null) metrics.push({ label: "Cliques", value: formatInteger(v.totals.clicks) });
  const details = [...v.platforms.map((pl) => `${pl.label}: ${pl.campaigns.length} campanha(s)`), ...(p.insights.length ? [`${p.insights.length} insight(s)`] : [])];
  return { metrics, details };
}

function buildPreview(parsed: ParsedImport, existingReports: ReportIndexEntry[], record: ImportRecord, sheets: ImportPreview["sheets"], documentPages: number | null, issues: IssueCollector): ImportPreview {
  const sameType = existingReports.filter((r) => r.type === record.reportType && r.status !== "archived");
  const existingFor = (key: string, kind: "dataset" | "document"): PreviewPeriod["existing"] => {
    const list = sameType.filter((r) => r.periodKey === key && r.kind === kind);
    if (list.some((r) => r.status === "published")) return "published";
    if (list.some((r) => r.status === "draft")) return "draft";
    return list.length ? "other" : "none";
  };
  if (parsed.kind === "document") {
    const key = periodKey(parsed.period);
    return {
      kind: "document",
      sourceType: parsed.sourceType,
      sheets: [],
      periods: [{ periodKey: key, period: parsed.period, label: formatPeriod(parsed.period), existing: existingFor(key, "document"), metrics: [], details: parsed.pages ? [`${parsed.pages} página(s)`] : [] }],
      suggestedPeriodKeys: [key],
      documentPages,
    };
  }
  const periods: PreviewPeriod[] = parsed.periods.map((p) => ({ periodKey: p.periodKey, period: p.period, label: formatPeriod(p.period), existing: existingFor(p.periodKey, "dataset"), ...periodMetrics(parsed.reportType, p) }));
  const requested = record.requestedPeriod ? periodKey(record.requestedPeriod) : null;
  let suggested = requested && periods.some((p) => p.periodKey === requested) ? [requested] : [];
  if (!suggested.length) {
    // Sem período pedido (ou não encontrado): sugere os que ainda não existem; senão o mais recente.
    const fresh = periods.filter((p) => p.existing === "none").map((p) => p.periodKey);
    suggested = fresh.length ? fresh : periods.slice(-1).map((p) => p.periodKey);
    if (requested && periods.length) {
      issues.warn("requested_period_missing", `O período selecionado (${formatPeriod(record.requestedPeriod!)}) não aparece no arquivo. Períodos encontrados: ${periods.map((p) => p.label).join(", ")}.`);
    }
  }
  // Aviso de comparação: sem período anterior publicado não há variação a exibir.
  const published = sameType.filter((r) => r.kind === "dataset" && r.status === "published");
  for (const key of suggested) {
    const p = periods.find((x) => x.periodKey === key);
    if (p && !published.some((r) => r.period.start < p.period.start) && !periods.some((x) => x.period.start < p.period.start)) {
      issues.warn("no_previous", `Não há período anterior a ${p.label} para comparação — o dashboard não mostrará variações.`);
    }
  }
  return { kind: "dataset", sourceType: parsed.sourceType, sheets, periods, suggestedPeriodKeys: suggested, documentPages: null };
}

async function loadParsed(record: ImportRecord): Promise<ParsedImport> {
  if (!record.parsedPath) throw new UserFacingError("Esta importação ainda não foi validada.");
  const doc = await readJSON(getStorage(), record.parsedPath, ParsedImportSchema);
  if (!doc) throw new UserFacingError("Os dados validados expiraram. Envie o arquivo novamente.");
  return doc.data;
}

/**
 * CSV parcial: parte do relatório mais recente do período (rascunho ou
 * publicado) e substitui apenas a seção enviada — gerando NOVO rascunho.
 */
async function mergePartialCommercial(clientId: string, p: ParsedPeriod): Promise<{ data: CommercialData; base: ReportManifest | null }> {
  const repos = getRepositories();
  const index = await repos.reports.getIndex(clientId);
  const candidates = index.reports
    .filter((r) => r.type === "commercial" && r.kind === "dataset" && r.periodKey === p.periodKey && (r.status === "draft" || r.status === "published"))
    .sort((a, b) => (a.status === b.status ? (a.updatedAt < b.updatedAt ? 1 : -1) : a.status === "draft" ? -1 : 1));
  const baseEntry = candidates[0];
  const baseManifest = baseEntry ? await getReportManifest(clientId, baseEntry.id) : null;
  const baseData = baseManifest ? await getReportData(baseManifest) : null;
  const incoming = p.data as Partial<CommercialData>;
  const base: Partial<CommercialData> = baseData?.type === "commercial" ? baseData.data : {};
  if (!base.funnel?.length && !p.sections.includes("funnel")) {
    throw new UserFacingError(`Ainda não existe um relatório comercial de ${formatPeriod(p.period)}. Envie primeiro o funil (ou a planilha completa) desse período.`);
  }
  const merged = {
    schemaVersion: 1,
    period: p.period,
    currency: base.currency ?? "BRL",
    funnel: p.sections.includes("funnel") ? incoming.funnel : base.funnel,
    financial: p.sections.includes("financial") ? incoming.financial : (base.financial ?? null),
    channels: p.sections.includes("channels") ? incoming.channels : (base.channels ?? []),
    dimensions: p.sections.includes("dimensions") ? [...(base.dimensions ?? []).filter((d) => !(incoming.dimensions ?? []).some((i) => i.key === d.key)), ...(incoming.dimensions ?? [])] : (base.dimensions ?? []),
    extraMetrics: base.extraMetrics ?? [],
    context: base.context ?? null,
  };
  const check = CommercialDataSchema.safeParse(merged);
  if (!check.success) throw new UserFacingError(`Não foi possível combinar o CSV com o relatório de ${formatPeriod(p.period)}.`);
  return { data: check.data, base: baseManifest };
}

const SOURCE_BY_FORMAT: Record<string, SourceType> = { xlsx: "xlsx", xls: "xls", csv: "csv", html_structured: "html_structured", pdf: "pdf", html_legacy: "html_legacy" };

/** Etapa 3: cria rascunho(s) para os períodos escolhidos. Nunca publica. */
export async function confirmImport(importId: string, options: { periodKeys: string[] }): Promise<ImportRecord> {
  const record = await requireImport(importId);
  if (record.status !== "validated") throw new UserFacingError(record.status === "imported" ? "Esta importação já foi concluída." : "Corrija os erros e envie o arquivo novamente antes de confirmar.");
  const parsed = await loadParsed(record);
  const repos = getRepositories();
  const reportIds: string[] = [];
  const warnings = record.issues.filter((i) => i.level === "warning");
  const ext = record.format === "html" ? "html" : record.format;

  if (parsed.kind === "document") {
    const report = await createDraftReport({
      clientId: record.clientId,
      type: record.reportType,
      kind: "document",
      period: parsed.period,
      title: parsed.title ?? record.title ?? (parsed.sourceType === "pdf" ? "Relatório em PDF" : "Relatório em HTML"),
      source: { type: parsed.sourceType, fileName: record.fileName, size: record.size, contentType: record.contentType },
      original: { copyFrom: record.stagingPath },
      originalExtension: ext,
      warnings,
      allowDownload: record.allowDownload,
      importId,
    });
    reportIds.push(report.id);
  } else {
    const selected = parsed.periods.filter((p) => options.periodKeys.includes(p.periodKey));
    if (!selected.length) throw new UserFacingError("Selecione pelo menos um período para importar.");
    for (const p of selected) {
      let data: ReportData;
      let insights: Insight[] = p.insights.map((i) => ({ ...i, id: newInsightId(), source: "import" as const }));
      if (parsed.reportType === "commercial") {
        if (parsed.partial) {
          const merged = await mergePartialCommercial(record.clientId, p);
          data = { type: "commercial", data: merged.data };
          // Mantém os insights já escritos no relatório-base e acrescenta os do CSV.
          if (merged.base) insights = [...merged.base.insights, ...insights];
        } else data = { type: "commercial", data: CommercialDataSchema.parse(p.data) };
      } else data = { type: "traffic", data: TrafficDataSchema.parse(p.data) };

      const report = await createDraftReport({
        clientId: record.clientId,
        type: record.reportType,
        kind: "dataset",
        period: p.period,
        title: record.title,
        source: { type: SOURCE_BY_FORMAT[parsed.sourceType], fileName: record.fileName, size: record.size, contentType: record.contentType },
        original: { copyFrom: record.stagingPath },
        originalExtension: ext,
        data,
        insights: insights.slice(0, 12),
        warnings,
        allowDownload: record.allowDownload,
        importId,
      });
      reportIds.push(report.id);
    }
  }

  const done = await saveRecord({ ...record, status: "imported", reportIds, completedAt: new Date().toISOString() });
  // O original já foi copiado para a pasta do relatório; o temporário pode sair.
  await repos.imports.deleteFiles([record.stagingPath, ...(record.parsedPath ? [record.parsedPath] : [])]).catch((e) => logError("import:cleanup", e));
  await logEvent("import.completed", { clientId: record.clientId, summary: `${record.fileName}: ${reportIds.length} rascunho(s) criado(s).`, meta: { importId } });
  return done;
}

export async function discardImport(importId: string): Promise<ImportRecord> {
  const record = await requireImport(importId);
  if (record.status === "imported") throw new UserFacingError("Esta importação já gerou relatórios. Arquive o relatório, se necessário.");
  await getRepositories().imports.deleteFiles([record.stagingPath, ...(record.parsedPath ? [record.parsedPath] : [])]).catch(() => undefined);
  const saved = await saveRecord({ ...record, status: "discarded", parsedPath: null, completedAt: new Date().toISOString() });
  await logEvent("import.discarded", { clientId: record.clientId, summary: `Upload ${record.fileName} descartado.`, meta: { importId } });
  return saved;
}
