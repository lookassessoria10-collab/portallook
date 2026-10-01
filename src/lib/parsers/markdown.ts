import Papa from "papaparse";
import { matrixToSheet } from "./sheet";
import { FileReadError, MAX_ROWS_PER_SHEET, MAX_SHEETS, type RawSheet, type RawWorkbook } from "./types";

const SEPARATOR_ROW = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const BOLD_TITLE = /^\*\*(.+?)\*\*:?$/;

/** Célula de tabela Markdown sem a formatação (negrito, itálico, código, links). */
function cleanCell(cell: string): string {
  return cell
    .replace(/\\\|/g, "|")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_]([^*_]+)[*_](?=[^\w*]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .trim();
}

/** Título de seção sem numeração: "1. Funil", "2) Canais", "3 - Financeiro" → "Funil". */
function cleanTitle(text: string): string {
  return cleanCell(text)
    .replace(/^(\d+|[ivx]+)\s*[.)\-–:]\s*/i, "")
    .trim();
}

/** Divide uma linha "| a | b |" em células, respeitando "\|" escapado. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map(cleanCell);
}

function tooBig(): never {
  throw new FileReadError(`Os dados colados passam do limite (${MAX_SHEETS} tabelas ou ${MAX_ROWS_PER_SHEET.toLocaleString("pt-BR")} linhas por tabela). Divida em mais de um envio.`);
}

/**
 * Tabelas Markdown (como as geradas por planilhas, Notion ou IA) → abas.
 * Cada tabela vira uma aba com o nome do título (#, ##, **negrito**) logo acima
 * dela — "## Funil", "## Canais" — ou `defaultName` quando não há título.
 * A linha separadora "|---|" é opcional. Os números de linha são os do texto colado.
 */
export function readMarkdownTables(text: string, defaultName: string): RawSheet[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const sheets: RawSheet[] = [];
  const used = new Map<string, number>();
  let title: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const heading = line.includes("|") ? null : (HEADING.exec(line) ?? BOLD_TITLE.exec(line));
    if (heading) {
      title = cleanTitle(heading[heading.length - 1]) || null;
      i++;
      continue;
    }
    if (line.includes("|") && !SEPARATOR_ROW.test(line)) {
      // Tabela: linhas seguidas com "|". A separadora "|---|---|" é ignorada onde estiver.
      const matrix: string[][] = [];
      const lineNumbers: number[] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        const current = lines[i].trim();
        if (!SEPARATOR_ROW.test(current)) {
          matrix.push(splitRow(current));
          lineNumbers.push(i + 1);
          if (matrix.length > MAX_ROWS_PER_SHEET + 1) tooBig();
        }
        i++;
      }
      if (matrix.length < 2) continue; // uma linha solta com "|" não é tabela
      const untitled = title === null;
      let name = title ?? defaultName;
      const count = used.get(name) ?? 0;
      used.set(name, count + 1);
      if (count) name = `${name} (${count + 1})`;
      sheets.push({ ...matrixToSheet(name, matrix, lineNumbers), untitled });
      if (sheets.length > MAX_SHEETS) tooBig();
      title = null;
      continue;
    }
    // Texto solto entre o título e a tabela ("Dados de janeiro a agosto:") mantém o título.
    i++;
  }
  return sheets;
}

/**
 * Dados colados no painel: tabelas Markdown ou, na falta delas, células copiadas
 * de uma planilha (Excel/Google Sheets colam separado por tabulação). O navegador
 * envia sempre UTF-8 — sem tentar outras codificações.
 */
export function readPastedData(buffer: Buffer, defaultName: string): RawWorkbook {
  const text = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
  if (!text.trim()) throw new FileReadError("Nenhum dado foi colado.");
  const tables = readMarkdownTables(text, defaultName);
  if (tables.length) return { format: "md", sheets: tables };

  // Células copiadas: mantém as linhas vazias na leitura para os números baterem com o texto colado.
  const result = Papa.parse<string[]>(text.replace(/\r\n?/g, "\n"), { header: false, skipEmptyLines: false, delimitersToGuess: ["\t", ";", ","] });
  const matrix: string[][] = [];
  const lineNumbers: number[] = [];
  result.data.forEach((row, index) => {
    if (row.some((c) => c.trim() !== "")) {
      matrix.push(row);
      lineNumbers.push(index + 1);
    }
  });
  if (matrix.length > MAX_ROWS_PER_SHEET + 1) tooBig();
  if (matrix.length < 2 || (matrix[0]?.length ?? 0) < 2) {
    throw new FileReadError(
      "Não encontramos uma tabela nos dados colados. Cole uma tabela em Markdown (uma linha de cabeçalho como | Mês | Investimento | Impressões | e uma linha por registro) ou copie as células direto da planilha, incluindo a linha de cabeçalho.",
    );
  }
  return { format: "md", sheets: [matrixToSheet(defaultName, matrix, lineNumbers)] };
}
