import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/dates/period";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { AccessActions } from "@/features/admin/components/access-actions";
import { getPortalLink } from "@/features/clients/access";
import { getClient } from "@/features/clients/service";

export const metadata: Metadata = { title: "Acesso" };

const HISTORY_LABEL = { generated: "Link gerado", revoked: "Link revogado", disabled: "Acesso desativado", enabled: "Acesso reativado" } as const;

export default async function ClientAccessPage(props: PageProps<"/adm/clientes/[id]/acesso">) {
  const { id } = await props.params;
  const client = await getClient(id);
  if (!client) notFound();
  const { access, url } = await getPortalLink(client);
  const tz = env().APP_TIMEZONE;
  const enabled = access?.enabled ?? true;

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader title="Link exclusivo" subtitle="Sem login: quem tem o link vê o portal deste cliente — e somente dele." icon={<KeyRound className="size-4" />} />
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {!enabled ? <Badge tone="negative">Acesso desativado</Badge> : url ? <Badge tone="positive">Ativo</Badge> : <Badge tone="attention">Sem link</Badge>}
            {access?.token ? <span className="text-xs text-text-3">Final …{access.token.hint} · criado em {formatDateTime(access.token.createdAt, tz)}</span> : null}
          </div>
          {url ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly value={url} aria-label="Link exclusivo do cliente" className="h-11 min-w-0 flex-1 rounded-[10px] border border-border-strong bg-bg-elevated px-3 font-mono text-[13px] text-text-2" />
              <CopyButton value={url} variant="primary" size="lg" />
            </div>
          ) : (
            <p className="rounded-xl bg-attention-soft px-4 py-3 text-sm text-attention">Este cliente não tem link ativo. Gere um novo link para liberar o acesso.</p>
          )}
          <AccessActions clientId={client.id} hasToken={Boolean(access?.token)} enabled={enabled} />
        </CardBody>
      </Card>

      <Card className="xl:col-span-4">
        <CardHeader title="Histórico do acesso" icon={<ShieldCheck className="size-4" />} />
        <CardBody>
          {access?.history.length ? (
            <ol className="space-y-3">
              {access.history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="text-sm">
                  <p className="font-semibold text-text">
                    {HISTORY_LABEL[h.action]}
                    {h.hint ? <span className="font-normal text-text-3"> · final …{h.hint}</span> : null}
                  </p>
                  <p className="text-xs text-text-3">{formatDateTime(h.at, tz)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-3">Nenhuma alteração registrada.</p>
          )}
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-text-3">
            O token tem 256 bits aleatórios, é validado no servidor com comparação em tempo constante e guardado apenas como hash (e cifrado, para permitir copiar o link). Ao gerar um novo, o anterior deixa de funcionar na hora.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
