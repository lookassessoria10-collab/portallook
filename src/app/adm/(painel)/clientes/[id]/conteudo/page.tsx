import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/dates/period";
import { normalizeText } from "@/lib/ids";
import { EmptyState } from "@/components/ui/empty-state";
import { getClient } from "@/features/clients/service";
import { findClickUpList, applyContentRules, contentStatus, contentWarnings, HIDDEN_REASON_LABEL } from "@/features/content/rules";
import { loadContentAdmin } from "@/features/content/service";
import { CONTENT_STATUSES, type ContentStatus } from "@/features/content/schema";
import { ContentSettings } from "@/features/content/components/content-settings";
import { CONTENT_TAB_PARAM } from "@/features/portal/params";

export const metadata: Metadata = { title: "Conteúdo" };

export default async function ClientContentPage(props: PageProps<"/adm/clientes/[id]/conteudo">) {
  const { id } = await props.params;
  const client = await getClient(id);
  if (!client) notFound();
  const view = await loadContentAdmin(client);

  if (!view.configured) {
    return (
      <div className="card">
        <EmptyState
          icon={<CalendarDays />}
          title="Integração com o ClickUp não configurada"
          description={
            <>
              Para mostrar o planejamento de conteúdo no portal, cadastre a variável <code className="rounded bg-surface-2 px-1.5 py-0.5 text-text">CLICKUP_API_TOKEN</code> na Vercel (Settings → Environment Variables) com o token de um usuário do ClickUp que só tenha acesso de leitura às listas dos clientes, e faça um novo deploy.
            </>
          }
        />
      </div>
    );
  }

  const { settings, data, resolved, lists, teamId, today } = view;
  const classified = data ? applyContentRules(data.items, settings.rules) : null;
  const warnings = classified ? contentWarnings(classified.visible, today) : { pastNotPublished: [], awaiting: [], noFormat: [] };
  const brief = (i: { id: string; date: string; name: string }) => ({ id: i.id, date: i.date, name: i.name });

  // Status da lista agrupados pela situação que o cliente vê.
  const statusMap = CONTENT_STATUSES.map((status: ContentStatus) => ({
    status,
    sources: (data?.statuses ?? []).filter((s) => contentStatus({ statusName: s.name, statusType: s.type, progress: [] }) === status).map((s) => ({ name: s.name, color: s.color })),
  }));

  // Caixas do campo TIPO: as opções da lista, mais algum tipo marcado que a lista não tem mais.
  const typeOptions = new Map<string, string>();
  for (const name of data?.typeOptions ?? []) typeOptions.set(normalizeText(name), name);
  for (const t of settings.rules.types) if (!typeOptions.has(t)) typeOptions.set(t, t);

  const current = resolved.list
    ? { ...resolved.list, auto: resolved.auto, url: teamId ? `https://app.clickup.com/${teamId}/v/li/${resolved.list.id}` : null }
    : null;

  return (
    <ContentSettings
      clientId={client.id}
      enabled={settings.enabled}
      listId={settings.listId}
      current={current}
      autoName={findClickUpList(client, lists)?.name ?? null}
      lists={[...lists].sort((a, b) => (a.folder ?? "").localeCompare(b.folder ?? "", "pt-BR") || a.name.localeCompare(b.name, "pt-BR"))}
      rules={settings.rules}
      typeOptions={[...typeOptions].map(([value, label]) => ({ value, label }))}
      sync={{ fetchedLabel: data ? formatDateTime(data.fetchedAt, env().APP_TIMEZONE) : null, error: view.error, from: data?.from ?? null, to: data?.to ?? null }}
      preview={classified ? { total: data!.items.length, visible: classified.visible.length, hidden: classified.hidden.length, awaiting: warnings.awaiting.length } : null}
      hidden={(classified?.hidden ?? []).map((h) => ({ id: h.item.id, date: h.item.date, name: h.item.name, reason: HIDDEN_REASON_LABEL[h.reason], url: h.item.url }))}
      warnings={{ pastNotPublished: warnings.pastNotPublished.map(brief), noFormat: warnings.noFormat.map(brief) }}
      statusMap={statusMap}
      previewHref={`/adm/clientes/${client.id}/portal?aba=${CONTENT_TAB_PARAM}`}
    />
  );
}
