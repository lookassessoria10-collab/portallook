export type CellValue = string | number | boolean | Date | null;

export interface RawRow {
  /** Número da linha no arquivo (1 = primeira linha), para mensagens de erro. */
  line: number;
  cells: Record<string, CellValue>;
}

export interface RawSheet {
  name: string;
  headers: string[];
  rows: RawRow[];
  /** Tabela colada sem título acima dela (o nome é o padrão do tipo de relatório). */
  untitled?: boolean;
  /** Textos acima do cabeçalho (ex.: título "ANÁLISE DE DADOS - INSTAGRAM - 2024"). */
  preamble?: string[];
}

export interface RawWorkbook {
  format: "xlsx" | "xls" | "csv" | "md";
  sheets: RawSheet[];
  /** Todas as abas do arquivo, inclusive as que não foram lidas (ver `select` em readExcel). */
  sheetNames?: string[];
}

/** Falha de leitura com mensagem pronta para o usuário. */
export class FileReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileReadError";
  }
}

export const MAX_ROWS_PER_SHEET = 5000;
export const MAX_SHEETS = 30;
