import "server-only";
import { createId } from "@/lib/ids";
import { logError } from "@/lib/errors";
import { getRepositories } from "@/server/repositories";
import type { EventType, PortalEvent } from "./schema";

/**
 * Registro básico de eventos. Nunca interrompe a operação principal: se o log
 * falhar, apenas registra no console do servidor. Nunca grava tokens completos.
 */
export async function logEvent(
  type: EventType,
  input: { clientId?: string | null; summary: string; actor?: string | null; meta?: PortalEvent["meta"] },
): Promise<void> {
  try {
    await getRepositories().events.append({
      id: createId("ev"),
      type,
      at: new Date().toISOString(),
      clientId: input.clientId ?? null,
      actor: input.actor ?? null,
      summary: input.summary,
      meta: input.meta ?? {},
    });
  } catch (e) {
    logError(`event:${type}`, e);
  }
}

export function listRecentEvents(options?: { clientId?: string; limit?: number; months?: number }) {
  return getRepositories().events.listRecent(options);
}
