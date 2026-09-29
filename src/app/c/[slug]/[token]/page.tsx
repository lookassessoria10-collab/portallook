import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalClient, portalBasePath } from "@/features/portal/access";
import { loadPortalModel } from "@/features/portal/model";
import { PortalView } from "@/features/portal/components/portal-view";
import type { PortalLinks } from "@/features/portal/components/portal-sections";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/c/[slug]/[token]">): Promise<Metadata> {
  const { slug, token } = await props.params;
  const client = await getPortalClient(slug, token);
  return { title: client ? `${client.shortName} · Relatórios` : "Link indisponível", robots: { index: false, follow: false } };
}

function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function ClientPortalPage(props: PageProps<"/c/[slug]/[token]">) {
  const { slug, token } = await props.params;
  const search = await props.searchParams;
  const client = await getPortalClient(slug, token);
  if (!client) notFound();

  const base = portalBasePath(slug, token);
  const model = await loadPortalModel(client, { tab: one(search.aba), period: one(search.periodo), mode: "client" });
  const tabParam = model.tab === "traffic" ? "trafego" : "comercial";
  const links: PortalLinks = {
    period: (key) => `${base}?aba=${tabParam}&periodo=${encodeURIComponent(key)}`,
    document: (id) => `${base}/relatorio/${id}`,
    file: (id, download) => `${base}/arquivo/${id}${download ? "?download=1" : ""}`,
  };

  return <PortalView model={model} basePath={base} links={links} logoUrl={client.logo ? `${base}/logo` : null} />;
}
