import { FileReadError } from "./types";

export interface PdfInfo {
  pages: number | null;
  encrypted: boolean;
  complete: boolean;
}

/** Validação mínima de PDF (sem extração de dados no MVP). */
export function inspectPdf(buffer: Buffer): PdfInfo {
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new FileReadError("Este arquivo não é um PDF válido.");
  const text = buffer.toString("latin1");
  const pageMatches = text.match(/\/Type\s*\/Page(?!s)\b/g);
  return {
    pages: pageMatches?.length ?? null,
    encrypted: /\/Encrypt\b/.test(text),
    complete: /%%EOF\s*$/.test(text.slice(-2048)),
  };
}
