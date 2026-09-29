import { getSession } from "@/features/auth/session";
import { serveReportOriginal } from "@/features/reports/files";
import { getReportManifest } from "@/features/reports/service";
import { logError } from "@/lib/errors";
import { isValidId } from "@/lib/ids";

export const dynamic = "force-dynamic";

/** Original do relatório para a equipe (inclusive rascunhos). */
export async function GET(request: Request, ctx: RouteContext<"/api/adm/clientes/[id]/relatorios/[reportId]/arquivo">) {
  if (!(await getSession())) return new Response("Sessão expirada.", { status: 401 });
  try {
    const { id, reportId } = await ctx.params;
    if (!isValidId(id, "cl") || !isValidId(reportId, "rp")) return new Response("Não encontrado.", { status: 404 });
    const manifest = await getReportManifest(id, reportId);
    if (!manifest || manifest.clientId !== id) return new Response("Não encontrado.", { status: 404 });
    return await serveReportOriginal(manifest, { download: new URL(request.url).searchParams.get("download") === "1" });
  } catch (e) {
    logError("admin:file", e);
    return new Response("Não foi possível abrir o arquivo.", { status: 500 });
  }
}
