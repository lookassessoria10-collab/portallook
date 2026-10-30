import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it } from "vitest";
import { readExcel } from "@/lib/parsers/xlsx";
import { IssueCollector } from "@/features/uploads/issues";
import { commercialTemplateWorkbook, workbookBuffer } from "@/features/uploads/templates";
import { normalizeCommercial } from "@/features/commercial/normalize";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { useMemoryStorage } from "./helpers/setup";
import { createClient } from "@/features/clients/service";
import { confirmImport, initImport, processImport, receiveFile } from "@/features/uploads/service";
import { getReportData, getReportManifest } from "@/features/reports/service";
import type { ClientInput } from "@/features/clients/input";

type Row = Array<string | number | null>;
const HEADER = ["Mês", "Google", "Instagram", "Indicação da Família", "Panfleto", "Convênio"];

/** Formato "origem dos pacientes": uma aba por ano, meses sem ano, canais nas colunas e Total. */
const ORIGIN: Record<string, Row[]> = {
  "2025": [
    [...HEADER],
    ["Novembro", 10, 2, 30, 0, 1],
    ["Dezembro", 8, 0, 25, 1, 0],
  ],
  "2026": [
    [...HEADER, "Total"],
    ["Janeiro", 12, 1, 40, 0, 2, 55],
    ["Fevereiro", 9, null, 33, 0, 1, 50],
    ["Março", "", "", "", "", "", 0],
    ["TOTAL", 21, 1, 73, 0, 3, 105],
  ],
};

function book(sheets: Record<string, Row[]>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return workbookBuffer(wb);
}

function read(sheets: Record<string, Row[]>, fileName: string | null = "[Cliente] Origem dos Pacientes.xlsx") {
  const issues = new IssueCollector();
  const result = normalizeCommercial(readExcel(book(sheets), "xlsx"), { granularity: "month", requestedPeriod: null, fileName }, issues);
  return { ...result, issues };
}

describe("planilha de origem com uma aba por ano", () => {
  it("lê os meses pelo ano da aba, soma os canais no funil e pula linhas de total e meses vazios", () => {
    const { periods, sheets, issues } = read(ORIGIN);
    expect(issues.errors).toEqual([]);
    expect(periods.map((p) => p.periodKey)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(sheets.map((s) => s.recognizedAs)).toEqual(["Origem por canal · 2025", "Origem por canal · 2026"]);
    const jan = CommercialDataSchema.parse(periods[2].data);
    expect(jan.funnel).toEqual([{ key: "novos-pacientes", label: "Novos pacientes", order: 1, value: 55 }]);
    expect(jan.channels.map((c) => [c.label, c.leads, c.kind])).toEqual([
      ["Google", 12, "organic"],
      ["Instagram", 1, "organic"],
      ["Indicação da Família", 40, "referral"],
      ["Panfleto", 0, "offline"],
      ["Convênio", 2, "other"],
    ]);
    // Célula vazia num mês com dados = não informado (diferente de zero); o Total diferente da soma vira aviso.
    const feb = CommercialDataSchema.parse(periods[3].data);
    expect(feb.channels.find((c) => c.label === "Instagram")?.leads).toBeNull();
    expect(feb.funnel[0].value).toBe(43);
    expect(issues.warnings.some((w) => w.code === "channel_sum_mismatch" && w.message.includes("Fevereiro de 2026"))).toBe(true);
  });

  it("dá nome à etapa pelo arquivo", () => {
    const label = (fileName: string | null) => CommercialDataSchema.parse(read(ORIGIN, fileName).periods[0].data).funnel[0].label;
    expect([label("Origem dos Pacientes.xlsx"), label("origem dos clientes 2026.xlsx"), label("canais.xlsx"), label(null)]).toEqual(["Novos pacientes", "Novos clientes", "Leads", "Leads"]);
  });

  it("aponta o mês que não é mês", () => {
    const { issues } = read({ "2026": [[...HEADER], ["Semana 1", 1, 1, 1, 1, 1]] });
    expect(issues.errors.map((e) => e.message)).toEqual(['O mês "Semana 1" na aba 2026, linha 2, não é válido. Use o nome do mês (ex.: "Setembro").']);
  });

  it("os outros formatos continuam como antes", () => {
    // Abas de ano misturadas com outra aba: não é a planilha de origem — segue pedindo o Funil.
    const mixed = read({ ...ORIGIN, Resumo: [["Canal", "Leads"], ["Google", 3]] });
    expect(mixed.issues.errors.some((e) => e.code === "missing_sheet")).toBe(true);
    // Com aba Funil, as abas de ano seguem como detalhamento (o comportamento de sempre).
    const withFunnel = read({ Funil: [["Mês", "Leads"], ["01/2026", 10]], "2026": ORIGIN["2026"] });
    expect(withFunnel.sheets.map((s) => s.recognizedAs).sort()).toEqual(["Detalhamento: 2026", "Funil"]);
    // O modelo oficial lê igual.
    const issues = new IssueCollector();
    const template = normalizeCommercial(readExcel(workbookBuffer(commercialTemplateWorkbook()), "xlsx"), { granularity: "month", requestedPeriod: null, fileName: "Origem dos Pacientes.xlsx" }, issues);
    expect(template.sheets.some((s) => s.recognizedAs?.startsWith("Origem"))).toBe(false);
    expect(template.periods.map((p) => p.periodKey)).toEqual(["2026-08", "2026-09"]);
  });
});

describe("envio da planilha de origem pelo assistente", () => {
  beforeEach(() => {
    useMemoryStorage();
  });

  it("importa a planilha como veio, com o nome do arquivo definindo a etapa", async () => {
    const input: ClientInput = {
      name: "Clínica Teste", shortName: "Clínica Teste", slug: "clinica-teste", greetingName: "", segment: "", currency: "BRL", notes: "", roiMetric: "roas",
      commercial: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
      traffic: { enabled: false, cadence: "monthly", dueDay: 5, allowOriginalDownload: false },
    };
    const client = await createClient(input, null);
    const body = book(ORIGIN);
    const init = await initImport({ clientId: client.id, reportType: "commercial", fileName: "[Clínica] Origem dos Pacientes.xlsx", size: body.length, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", period: null });
    await receiveFile(init.importId, body);
    const record = await processImport(init.importId);
    expect(record.status).toBe("validated");
    const done = await confirmImport(record.id, { periodKeys: record.preview!.periods.map((p) => p.periodKey) });
    expect(done.reportIds).toHaveLength(4);
    const manifest = (await getReportManifest(client.id, done.reportIds[2]))!;
    expect(manifest.summary.leads).toBe(55);
    const data = await getReportData(manifest);
    expect(data?.type === "commercial" && data.data.funnel[0].label).toBe("Novos pacientes");
  });
});
