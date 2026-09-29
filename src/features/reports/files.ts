import "server-only";
import { getRepositories } from "@/server/repositories";
import type { ReportManifest } from "./schema";

/**
 * CSP aplicada ao HTML legado. `sandbox` sem `allow-same-origin` dá ao documento
 * uma origem opaca: sem acesso a cookies, localStorage ou APIs do portal — mesmo
 * que o arquivo seja aberto diretamente em uma aba.
 */
export const LEGACY_HTML_CSP = [
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "connect-src https:",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return cleaned || "relatorio";
}

const DOWNLOAD_EXT: Record<string, string> = { xlsx: "xlsx", xls: "xls", csv: "csv", pdf: "pdf", html_legacy: "html", html_structured: "html" };

/** Resposta com o arquivo original do relatório, sempre privada e sem cache compartilhado. */
export async function serveReportOriginal(manifest: ReportManifest, options: { download: boolean }): Promise<Response> {
  const source = manifest.source;
  if (!source?.path) return new Response("Arquivo não encontrado.", { status: 404 });
  const file = await getRepositories().reports.getOriginalStream(manifest);
  if (!file) return new Response("Arquivo não encontrado.", { status: 404 });

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  // Tamanho só quando conhecido: um Content-Length errado faz o navegador cortar o arquivo.
  if (file.size > 0) headers.set("Content-Length", String(file.size));

  const isHtml = source.type === "html_legacy" || source.type === "html_structured";
  if (options.download) {
    const ext = DOWNLOAD_EXT[source.type] ?? "bin";
    const base = safeFileName(source.fileName.replace(/\.[^.]+$/, ""));
    headers.set("Content-Type", isHtml ? "application/octet-stream" : source.contentType);
    headers.set("Content-Disposition", `attachment; filename="${base}.${ext}"`);
    return new Response(file.stream, { headers });
  }

  if (isHtml) {
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Content-Security-Policy", LEGACY_HTML_CSP);
    headers.set("X-Frame-Options", "SAMEORIGIN");
  } else if (source.type === "pdf") {
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", "inline");
  } else {
    // Planilhas não são exibidas inline.
    return new Response("Formato disponível apenas para download.", { status: 415 });
  }
  return new Response(file.stream, { headers });
}
