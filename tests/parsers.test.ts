import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { sniffFormat, sanitizeDisplayName, extensionOf } from "@/lib/parsers/sniff";
import { readExcel } from "@/lib/parsers/xlsx";
import { readCsv, decodeText } from "@/lib/parsers/csv";
import { inspectHtml } from "@/lib/parsers/html";
import { inspectPdf } from "@/lib/parsers/pdf";
import { dateCell, findColumn, monthCell, numberCell, percentCell } from "@/lib/parsers/cells";
import { FileReadError } from "@/lib/parsers/types";
import { commercialTemplateWorkbook, structuredHtmlExample, workbookBuffer } from "@/features/uploads/templates";

describe("identificação do formato pelo conteúdo", () => {
  it("reconhece xlsx, xls, pdf, html e csv", async () => {
    expect(sniffFormat(workbookBuffer(commercialTemplateWorkbook()))).toBe("xlsx");
    expect(sniffFormat(workbookBuffer(commercialTemplateWorkbook(), "xls"))).toBe("xls");
    const pdf = await PDFDocument.create();
    pdf.addPage();
    expect(sniffFormat(Buffer.from(await pdf.save()))).toBe("pdf");
    expect(sniffFormat(Buffer.from("<!doctype html><html><body>oi</body></html>"))).toBe("html");
    expect(sniffFormat(Buffer.from("Período;Leads\n09/2026;10\n"))).toBe("csv");
    expect(sniffFormat(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))).toBe("unknown");
  });

  it("nomes de arquivo são sanitizados", () => {
    expect(sanitizeDisplayName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeDisplayName('C:\\x\\rel<a>"tório".xlsx')).toBe("relatório.xlsx");
    expect(extensionOf("Relatório.XLSX")).toBe("xlsx");
    expect(extensionOf("semextensao")).toBe("");
  });
});

describe("leitura de planilhas", () => {
  it("lê abas e cabeçalhos do modelo, ignorando linhas vazias", () => {
    const wb = readExcel(workbookBuffer(commercialTemplateWorkbook()), "xlsx");
    const funil = wb.sheets.find((s) => s.name === "Funil")!;
    expect(funil.headers).toEqual(["Período", "Leads", "Agendamentos", "Comparecimentos"]);
    expect(funil.rows).toHaveLength(2);
    expect(funil.rows[0].cells.Leads).toBe(257);
  });

  it("arquivo corrompido gera mensagem humana", () => {
    expect(() => readExcel(Buffer.from("PK\u0003\u0004 corrompido"), "xlsx")).toThrow(FileReadError);
  });

  it("CSV com ponto e vírgula e acentos em Windows-1252", () => {
    const latin1 = Buffer.from("Per\xedodo;Canal;Leads\n09/2026;Indica\xe7\xe3o;4\n", "latin1");
    expect(decodeText(latin1)).toContain("Indicação");
    const wb = readCsv(latin1, "Canais");
    expect(wb.sheets[0].headers).toEqual(["Período", "Canal", "Leads"]);
    expect(wb.sheets[0].rows[0].cells.Canal).toBe("Indicação");
  });
});

describe("células", () => {
  it("números, percentuais e datas brasileiras", () => {
    expect(numberCell("R$ 1.208,17").value).toBeCloseTo(1208.17);
    expect(numberCell("abc").invalid).toBe(true);
    expect(numberCell("-").value).toBeNull();
    expect(percentCell("3,32%").value).toBeCloseTo(0.0332);
    expect(percentCell(3.32).value).toBeCloseTo(0.0332);
    expect(dateCell("21/09/2026")).toBe("2026-09-21");
    expect(dateCell("31/02/2026")).toBeNull();
    expect(dateCell(46286)).toBe("2026-09-21");
  });

  it("meses em vários formatos", () => {
    for (const v of ["09/2026", "2026-09", "set/2026", "set/26", "Setembro de 2026", "setembro 2026", "01/09/2026"]) {
      expect(monthCell(v)).toEqual({ year: 2026, month: 9 });
    }
    expect(monthCell("13/2026")).toBeNull();
    expect(monthCell("qualquer coisa")).toBeNull();
  });

  it("encontra colunas por apelidos, sem confundir colunas parecidas", () => {
    const headers = ["Campanha", "Cliques no link", "Custo por resultado", "Resultados", "Valor investido (R$)"];
    const link = findColumn(headers, ["cliques no link"]);
    expect(link).toBe("Cliques no link");
    expect(findColumn(headers, ["cliques"], [link])).toBeNull();
    expect(findColumn(headers, ["resultados"], ["Custo por resultado"])).toBe("Resultados");
    expect(findColumn(headers, ["investimento", "valor investido"])).toBe("Valor investido (R$)");
  });
});

describe("HTML e PDF", () => {
  it("HTML estruturado expõe os dados; HTML comum é legado", () => {
    const structured = inspectHtml(Buffer.from(structuredHtmlExample()));
    expect(structured.kind).toBe("structured");
    const legacy = inspectHtml(Buffer.from("<html><head><title>Dashboard antigo</title></head><body><script>alert(1)</script></body></html>"));
    expect(legacy).toEqual({ kind: "legacy", title: "Dashboard antigo" });
    expect(() => inspectHtml(Buffer.from('<script type="application/json" id="portal-look-data">{quebrado</script>'))).toThrow(FileReadError);
  });

  it("PDF: conta páginas e rejeita falsos PDFs", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.addPage();
    pdf.addPage();
    const info = inspectPdf(Buffer.from(await pdf.save({ useObjectStreams: false })));
    expect(info.pages).toBe(3);
    expect(info.encrypted).toBe(false);
    expect(() => inspectPdf(Buffer.from("não sou pdf"))).toThrow(FileReadError);
  });
});
