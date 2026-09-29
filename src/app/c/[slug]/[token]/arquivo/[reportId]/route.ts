import { getPortalClient, getVisibleReport } from "@/features/portal/access";
import { serveReportOriginal } from "@/features/reports/files";
import { logError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const NOT_FOUND = () => new Response("Não encontrado.", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, ctx: RouteContext<"/c/[slug]/[token]/arquivo/[reportId]">) {
  try {
    const { slug, token, reportId } = await ctx.params;
    const client = await getPortalClient(slug, token);
    if (!client) return NOT_FOUND();
    const manifest = await getVisibleReport(client, reportId);
    if (!manifest) return NOT_FOUND();
    const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
    if (wantsDownload && !manifest.allowDownload) return new Response("Download não disponível.", { status: 403 });
    return await serveReportOriginal(manifest, { download: wantsDownload });
  } catch (e) {
    logError("portal:file", e);
    return new Response("Não foi possível abrir o arquivo.", { status: 500 });
  }
}
