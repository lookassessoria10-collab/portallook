import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, History, Link2 } from "lucide-react";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/dates/period";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ModuleStatusCard } from "@/features/admin/components/module-status-card";
import { getPortalLink } from "@/features/clients/access";
import { getClientOverview, today } from "@/features/clients/service";
import { listRecentEvents } from "@/features/events/service";
import { EVENT_LABEL } from "@/features/events/schema";

export async function generateMetadata(props: PageProps<"/adm/clientes/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const o = await getClientOverview(id);
  return { title: o?.client.name ?? "Cliente" };
}

export default async function ClientOverviewPage(props: PageProps<"/adm/clientes/[id]">) {
  const { id } = await props.params;
  const isNew = (await props.searchParams).novo === "1";
  const o = await getClientOverview(id);
  if (!o) notFound();
  const tz = env().APP_TIMEZONE;
  const [link, events] = await Promise.all([getPortalLink(o.client), listRecentEvents({ clientId: id, limit: 12, months: 3 })]);
  const date = today();

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      {isNew ? (
        <p className="flex items-center gap-2 rounded-xl border border-[rgb(52_211_153/0.25)] bg-positive-soft px-4 py-3 text-sm text-text xl:col-span-12" role="status">
          <CircleCheck className="size-4 shrink-0 text-positive" aria-hidden />
          Cliente cadastrado. O link exclusivo já foi gerado — copie abaixo e envie ao cliente quando o primeiro relatório estiver publicado.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:col-span-8">
        <ModuleStatusCard clientId={id} type="commercial" module={o.client.modules.commercial} delivery={o.delivery.commercial} today={date} />
        <ModuleStatusCard clientId={id} type="traffic" module={o.client.modules.traffic} delivery={o.delivery.traffic} today={date} />
        {o.client.modules.media_plan.enabled ? <ModuleStatusCard clientId={id} type="media_plan" module={o.client.modules.media_plan} delivery={o.delivery.media_plan} today={date} /> : null}

        <Card className="md:col-span-2">
          <CardHeader title="Link do cliente" subtitle="Envie este endereço ao cliente. Ele continua válido a cada novo relatório." icon={<Link2 className="size-4" />} actions={<Link href={`/adm/clientes/${id}/acesso`} className="text-sm font-semibold text-primary hover:underline">Gerenciar</Link>} />
          <CardBody>
            {link.url && link.access?.enabled ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input readOnly value={link.url} aria-label="Link exclusivo do cliente" className="h-10 min-w-0 flex-1 rounded-[10px] border border-border-strong bg-bg-elevated px-3 font-mono text-[13px] text-text-2" />
                <CopyButton value={link.url} variant="primary" />
              </div>
            ) : (
              <p className="text-sm text-attention">{link.access?.enabled === false ? "O acesso ao portal está desativado." : "Nenhum link ativo. Gere um novo link na aba Acesso."}</p>
            )}
          </CardBody>
        </Card>

        {o.client.notes ? (
          <Card className="md:col-span-2">
            <CardHeader title="Observações internas" />
            <CardBody>
              <p className="whitespace-pre-line text-sm leading-relaxed text-text-2">{o.client.notes}</p>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <Card className="xl:col-span-4">
        <CardHeader title="Atividade recente" icon={<History className="size-4" />} />
        <CardBody>
          {events.length ? (
            <ol className="space-y-3.5">
              {events.map((e) => (
                <li key={e.id} className="relative pl-4 before:absolute before:left-0 before:top-1.5 before:size-1.5 before:rounded-full before:bg-primary">
                  <p className="text-sm font-semibold text-text">{EVENT_LABEL[e.type]}</p>
                  <p className="text-xs text-text-3">{e.summary}</p>
                  <p className="text-[11px] text-text-3">{formatDateTime(e.at, tz)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState compact title="Sem atividade registrada" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
