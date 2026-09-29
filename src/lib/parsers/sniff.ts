/**
 * Identificação do formato pelo CONTEÚDO (assinatura dos bytes), não só pela
 * extensão. A extensão precisa bater com o conteúdo.
 */
export type SniffedFormat = "xlsx" | "xls" | "csv" | "pdf" | "html" | "unknown";

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(buf: Uint8Array, bytes: number[]) {
  return bytes.every((b, i) => buf[i] === b);
}

function looksLikeText(buf: Uint8Array): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) control++;
  }
  return control / Math.max(1, sample.length) < 0.01;
}

export function sniffFormat(buf: Uint8Array): SniffedFormat {
  if (buf.length < 4) return "unknown";
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // ZIP: xlsx contém "xl/" e "[Content_Types].xml" nos nomes das entradas.
    const head = Buffer.from(buf.subarray(0, Math.min(buf.length, 64 * 1024))).toString("latin1");
    return head.includes("[Content_Types].xml") || head.includes("xl/") ? "xlsx" : "unknown";
  }
  if (startsWith(buf, OLE)) return "xls";
  if (!looksLikeText(buf)) return "unknown";
  const text = Buffer.from(buf.subarray(0, 4096)).toString("utf8").replace(/^﻿/, "").trimStart().toLowerCase();
  if (text.startsWith("<!doctype html") || text.startsWith("<html") || /<html[\s>]/.test(text.slice(0, 1024)) || (text.startsWith("<") && /<(head|body|meta|title)[\s>]/.test(text))) return "html";
  return "csv";
}

export const EXTENSION_FORMAT: Record<string, "xlsx" | "xls" | "csv" | "pdf" | "html"> = {
  xlsx: "xlsx",
  xls: "xls",
  csv: "csv",
  pdf: "pdf",
  html: "html",
  htm: "html",
};

export function extensionOf(fileName: string): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(fileName.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Nome exibido: sem caminho, sem caracteres de controle, tamanho limitado. */
export function sanitizeDisplayName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "arquivo";
  return base.replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "").trim().slice(0, 160) || "arquivo";
}
