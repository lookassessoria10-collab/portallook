import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ClientAvatar } from "@/components/brand/client-avatar";
import { ClientTabs } from "@/features/admin/components/client-tabs";
import { ClientStatusButton } from "@/features/admin/components/client-status-button";
import { getPortalLink } from "@/features/clients/access";
import { getClientOverview } from "@/features/clients/service";

export default async function ClientLayout({ children, params }: LayoutProps<"/adm/clientes/[id]">) {
  const { id } = await params;
  const overview = await getClientOverview(id);
  if (!overview) notFound();
  const { client } = overview;
  const link = await getPortalLink(client);
  const portalUrl = link.access?.enabled ? link.url : null;

  return (
    <div>
      <Link href="/adm/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-text-3 hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Clientes
      </Link>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ClientAvatar name={client.name} logoUrl={client.logo ? `/api/adm/clientes/${client.id}/logo?v=${encodeURIComponent(client.logo.updatedAt)}` : null} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-text">{client.name}</h1>
              {client.status === "active" ? <Badge tone="positive">Ativo</Badge> : client.status === "inactive" ? <Badge tone="attention">Inativo</Badge> : <Badge tone="muted">Arquivado</Badge>}
              {!link.access?.enabled ? <Badge tone="negative">Acesso desativado</Badge> : !link.url ? <Badge tone="attention">Sem link ativo</Badge> : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-text-3">
              /{client.slug}
              {client.segment ? ` · ${client.segment}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {portalUrl ? (
            <a href={portalUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
              <ExternalLink className="size-4" aria-hidden /> Ver portal
            </a>
          ) : null}
          {portalUrl ? <CopyButton value={portalUrl} size="sm" /> : null}
          <Link href={`/adm/clientes/${client.id}/portal`} className={buttonClass("ghost", "sm")}>
            <Eye className="size-4" aria-hidden /> Prévia com rascunhos
          </Link>
          <Link href={`/adm/clientes/${client.id}/configuracoes`} className={buttonClass("ghost", "sm")}>
            <Pencil className="size-4" aria-hidden /> Editar
          </Link>
          <ClientStatusButton clientId={client.id} status={client.status} name={client.name} />
        </div>
      </header>
      <div className="mt-6">
        <ClientTabs clientId={client.id} modules={{ commercial: client.modules.commercial.enabled, traffic: client.modules.traffic.enabled, media_plan: client.modules.media_plan.enabled }} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
