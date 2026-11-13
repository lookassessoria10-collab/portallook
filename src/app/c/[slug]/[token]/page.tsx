import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalClient, portalBasePath } from "@/features/portal/access";
import { loadPortalModel, SCALE_PARAM } from "@/features/portal/model";
import { loadPortalExtras } from "@/features/portal/extras";
import { REPORT_TYPE_PATH, REPORT_TYPES, reportTypeFromParam } from "@/features/reports/schema";
import { refreshSocialSheetIfStale } from "@/features/social/sheet-sync";
import { PortalView } from "@/features/portal/components/portal-view";
import type { PortalLinks } from "@/features/portal/components/portal-sections";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/c/[slug]/[token]">): Promise<Metadata> {
  const { slug, token } = await props.params;
  const client = await getPortalClient(slug, token);
  return { title: client ? `${client.shortName} · Central do Cliente` : "Link indisponível", robots: { index: false, follow: false } };
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
  // Rede social: meses novos da planilha Google (no máximo uma leitura a cada 10 min). Quem abre a própria
  // aba espera até 3 s para já ver o mês novo; nas outras abas, a leitura fica para depois da resposta.
  if (client.modules.social.enabled) {
    const requested = reportTypeFromParam(one(search.aba));
    const firstTab = REPORT_TYPES.find((t) => client.modules[t].enabled);
    await refreshSocialSheetIfStale({ waitMs: requested === "social" || (!one(search.aba) && firstTab === "social") ? 3000 : 0 });
  }
  const extras = await loadPortalExtras(client, one(search.aba));
  const model = await loadPortalModel(client, { tab: extras.active ? null : one(search.aba), period: one(search.periodo), scale: one(search.escala), year: one(search.ano), mode: "client", skipSelection: extras.active !== null });
  const tabParam = REPORT_TYPE_PATH[model.tab];
  const scaleParam = model.scales ? `&escala=${SCALE_PARAM[model.scale]}` : "";
  const yearParam = model.year !== null ? `&ano=${model.year}` : "";
  const links: PortalLinks = {
    overview: `${base}?aba=${tabParam}${scaleParam}${yearParam}`,
    scale: (scale) => `${base}?aba=${tabParam}&escala=${SCALE_PARAM[scale]}`,
    year: (year) => `${base}?aba=${tabParam}${scaleParam}&ano=${year}`,
    period: (key) => `${base}?aba=${tabParam}&periodo=${encodeURIComponent(key)}`,
    document: (id) => `${base}/relatorio/${id}`,
    file: (id, download) => `${base}/arquivo/${id}${download ? "?download=1" : ""}`,
  };

  return (
    <PortalView
      model={model}
      basePath={base}
      links={links}
      logoUrl={client.logo ? `${base}/logo` : null}
      section={one(search.secao)}
      extras={extras}
    />
  );
}
