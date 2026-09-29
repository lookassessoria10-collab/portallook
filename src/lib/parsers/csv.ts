import Papa from "papaparse";
import { matrixToSheet } from "./sheet";
import { FileReadError, MAX_ROWS_PER_SHEET, type RawWorkbook } from "./types";

/** Decodifica CSV em UTF-8; se houver caracteres inválidos, tenta Windows-1252 (Excel brasileiro). */
export function decodeText(buffer: Buffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer).replace(/^﻿/, "");
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(buffer);
}

export function readCsv(buffer: Buffer, sheetName: string): RawWorkbook {
  const text = decodeText(buffer);
  const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: "greedy", delimitersToGuess: [";", ",", "\t", "|"], preview: MAX_ROWS_PER_SHEET + 10 });
  if (!result.data.length) throw new FileReadError("O arquivo CSV está vazio.");
  if (result.errors.some((e) => e.type === "Delimiter") && result.data[0]?.length < 2) {
    throw new FileReadError("Não foi possível identificar as colunas deste CSV. Use ponto e vírgula ou vírgula como separador.");
  }
  return { format: "csv", sheets: [matrixToSheet(sheetName, result.data)] };
}
