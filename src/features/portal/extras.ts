import "server-only";
import type { Client } from "@/features/clients/schema";
import { loadPortalActions } from "@/features/actions/service";
import { loadPortalContent } from "@/features/content/service";
import type { PortalExtras } from "./components/portal-view";
import { ACTIONS_TAB_PARAM, CONTENT_TAB_PARAM } from "./params";

/**
 * Áreas sem períodos do portal (Conteúdo e Ações) e qual delas a URL abriu (`aba`).
 * Uma área sem nada para mostrar não aparece — e a URL dela cai na área de relatório padrão.
 */
export async function loadPortalExtras(client: Client, tabParam: string | null): Promise<PortalExtras> {
  const [content, actions] = await Promise.all([loadPortalContent(client), loadPortalActions(client)]);
  const active = tabParam === CONTENT_TAB_PARAM && content ? "content" : tabParam === ACTIONS_TAB_PARAM && actions ? "actions" : null;
  return { content, actions, active };
}
