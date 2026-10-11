import * as XLSX from "xlsx";
import { matrixToSheet } from "./sheet";
import { FileReadError, MAX_ROWS_PER_SHEET, MAX_SHEETS, type RawWorkbook } from "./types";

export interface ReadExcelOptions {
  /**
   * Escolhe as abas a converter a partir de todos os nomes do arquivo (ex.: só a aba
   * do cliente numa planilha com uma aba por cliente). O limite de abas vale depois da escolha.
   */
  select?: (names: string[]) => string[];
}

/** XLSX/XLS via SheetJS (versão oficial com correções de segurança). Fórmulas não são avaliadas: usa o valor salvo. */
export function readExcel(buffer: Buffer, format: "xlsx" | "xls", options: ReadExcelOptions = {}): RawWorkbook {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true, cellFormula: false, cellHTML: false, sheetRows: MAX_ROWS_PER_SHEET + 10, WTF: false });
  } catch {
    throw new FileReadError("Não foi possível ler esta planilha. O arquivo pode estar corrompido ou protegido por senha.");
  }
  if (!wb.SheetNames.length) throw new FileReadError("A planilha não tem nenhuma aba.");
  const chosen = options.select ? options.select([...wb.SheetNames]).filter((n) => wb.SheetNames.includes(n)) : wb.SheetNames;
  const sheets = chosen.slice(0, MAX_SHEETS).map((name) => {
    const ws = wb.Sheets[name];
    const matrix = ws ? (XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][]) : [];
    return matrixToSheet(name, matrix);
  });
  return { format, sheets, sheetNames: [...wb.SheetNames] };
}
