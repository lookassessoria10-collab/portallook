import { decodeText } from "./csv";
import { FileReadError } from "./types";

export type HtmlReport = { kind: "structured"; payload: unknown; title: string | null } | { kind: "legacy"; title: string | null };

const DATA_SCRIPT = /<script\b[^>]*\bid\s*=\s*["']portal-look-data["'][^>]*>([\s\S]*?)<\/script>/i;

/**
 * HTML estruturado: contém `<script type="application/json" id="portal-look-data">`
 * com os dados no formato do Portal Look. Qualquer outro HTML é "legado" e só
 * é exibido isolado (iframe sandbox), nunca inserido na aplicação.
 */
export function inspectHtml(buffer: Buffer): HtmlReport {
  const text = decodeText(buffer);
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 160) || null : null;
  const data = DATA_SCRIPT.exec(text);
  if (!data) return { kind: "legacy", title };
  try {
    return { kind: "structured", payload: JSON.parse(data[1]), title };
  } catch {
    throw new FileReadError('O bloco de dados "portal-look-data" deste HTML não é um JSON válido.');
  }
}
