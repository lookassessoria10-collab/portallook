import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getClient } from "@/features/clients/service";
import { loadPortalModel } from "@/features/portal/model";
import { PortalView } from "@/features/portal/components/portal-view";
import type { PortalLinks } from "@/features/portal/components/portal-sections";

export const metadata: Metadata = { title: "Prévia do portal" };

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : null;
}

/** Portal como o cliente vê, incluindo rascunhos (somente para a equipe). */
export default async function PortalPreviewPage(props: PageProps<"/adm/clientes/[id]/portal">) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const client = await getClient(id);
  if (!client) notFound();
  const base = `/adm/clientes/${id}/portal`;
  const model = await loadPortalModel(client, { tab: one(search.aba), period: one(search.periodo), mode: "preview" });
  const tabParam = model.tab === "traffic" ? "trafego" : "comercial";
  const links: PortalLinks = {
    overview: `${base}?aba=${tabParam}`,
    period: (key) => `${base}?aba=${tabParam}&periodo=${encodeURIComponent(key)}`,
    document: (reportId) => `/adm/clientes/${id}/relatorios/${reportId}`,
    file: (reportId, download) => `/api/adm/clientes/${id}/relatorios/${reportId}/arquivo${download ? "?download=1" : ""}`,
  };
  const isDraft = model.selection.primary?.status === "draft";
  return (
    <div className="-mx-4 rounded-[var(--radius-xl)] border border-border sm:mx-0">
      <PortalView
        model={model}
        basePath={base}
        links={links}
        logoUrl={client.logo ? `/api/adm/clientes/${id}/logo` : null}
        banner={
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-[rgb(140_156_248/0.3)] bg-info-soft px-3.5 py-2.5 text-[13px] text-text-2">
            <Eye className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            <span>
              <strong className="text-text">Prévia interna.</strong> Inclui rascunhos — o cliente vê apenas relatórios publicados.
              {isDraft ? <strong className="text-attention"> Este período está em rascunho.</strong> : null}
            </span>
          </p>
        }
      />
    </div>
  );
}
