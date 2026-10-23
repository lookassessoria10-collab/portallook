import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/dates/period";
import { getClient } from "@/features/clients/service";
import { getClientActions } from "@/features/actions/service";
import { ACTION_SHEET_NAMES } from "@/features/actions/sheet";
import { ACTIONS_TAB_PARAM } from "@/features/portal/params";
import { ClientActionsManager } from "@/features/actions/components/client-actions-manager";

export const metadata: Metadata = { title: "Ações" };

export default async function ClientActionsPage(props: PageProps<"/adm/clientes/[id]/acoes">) {
  const { id } = await props.params;
  const client = await getClient(id);
  if (!client) notFound();
  const actions = await getClientActions(client);
  return (
    <ClientActionsManager
      clientId={client.id}
      items={actions.items}
      enabled={actions.enabled}
      origin={actions.origin}
      sheet={actions.sheet}
      extractedAt={actions.extractedAt}
      updatedLabel={actions.origin === "stored" && actions.updatedAt ? formatDateTime(actions.updatedAt, env().APP_TIMEZONE) : null}
      sheetNames={ACTION_SHEET_NAMES}
      previewHref={`/adm/clientes/${client.id}/portal?aba=${ACTIONS_TAB_PARAM}`}
    />
  );
}
