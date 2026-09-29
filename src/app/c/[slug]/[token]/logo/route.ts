import { getPortalClient } from "@/features/portal/access";
import { getRepositories } from "@/server/repositories";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/c/[slug]/[token]/logo">) {
  const { slug, token } = await ctx.params;
  const client = await getPortalClient(slug, token);
  if (!client?.logo) return new Response(null, { status: 404 });
  const file = await getRepositories().clients.getFileStream(client.logo.path);
  if (!file) return new Response(null, { status: 404 });
  return new Response(file.stream, {
    headers: {
      "Content-Type": client.logo.contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
