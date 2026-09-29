import { getSession } from "@/features/auth/session";
import { getClient } from "@/features/clients/service";
import { getRepositories } from "@/server/repositories";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/adm/clientes/[id]/logo">) {
  if (!(await getSession())) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  const client = await getClient(id);
  if (!client?.logo) return new Response(null, { status: 404 });
  const file = await getRepositories().clients.getFileStream(client.logo.path);
  if (!file) return new Response(null, { status: 404 });
  return new Response(file.stream, {
    headers: { "Content-Type": client.logo.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
