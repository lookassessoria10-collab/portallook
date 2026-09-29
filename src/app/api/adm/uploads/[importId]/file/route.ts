import { getSession } from "@/features/auth/session";
import { isSameOrigin } from "@/features/uploads/request-guard";
import { receiveFile, requireImport, uploadLimits } from "@/features/uploads/service";
import { LEGACY_HTML_CSP } from "@/features/reports/files";
import { getRepositories } from "@/server/repositories";
import { logError, toUserMessage } from "@/lib/errors";
import { isValidId } from "@/lib/ids";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Recebe o arquivo (upload pelo servidor, com progresso via XHR no navegador). */
export async function PUT(request: Request, ctx: RouteContext<"/api/adm/uploads/[importId]/file">) {
  if (!(await getSession())) return json(401, { error: "Sessão expirada. Entre novamente." });
  if (!isSameOrigin(request)) return json(403, { error: "Origem não permitida." });
  const { importId } = await ctx.params;
  if (!isValidId(importId, "im")) return json(404, { error: "Importação não encontrada." });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > uploadLimits().maxBytes) return json(413, { error: "O arquivo excede o tamanho máximo permitido." });
  try {
    const body = Buffer.from(await request.arrayBuffer());
    await receiveFile(importId, body);
    return json(200, { ok: true });
  } catch (e) {
    logError("upload:receive", e, { importId });
    return json(400, { error: toUserMessage(e, "Não foi possível receber o arquivo. Tente novamente.") });
  }
}

/** Prévia do arquivo ainda não importado (somente equipe). */
export async function GET(_request: Request, ctx: RouteContext<"/api/adm/uploads/[importId]/file">) {
  if (!(await getSession())) return new Response("Sessão expirada.", { status: 401 });
  const { importId } = await ctx.params;
  if (!isValidId(importId, "im")) return new Response("Não encontrado.", { status: 404 });
  try {
    const record = await requireImport(importId);
    if (record.format !== "pdf" && record.format !== "html") return new Response("Prévia disponível apenas para PDF e HTML.", { status: 415 });
    const file = await getRepositories().imports.getFileStream(record.stagingPath);
    if (!file) return new Response("Arquivo não encontrado.", { status: 404 });
    const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    if (record.format === "pdf") headers.set("Content-Type", "application/pdf");
    else {
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Content-Security-Policy", LEGACY_HTML_CSP);
    }
    return new Response(file.stream, { headers });
  } catch (e) {
    logError("upload:preview", e, { importId });
    return new Response("Não foi possível abrir a prévia.", { status: 500 });
  }
}
