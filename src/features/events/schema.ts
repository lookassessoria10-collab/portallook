import { z } from "zod";
import { TimestampSchema } from "@/features/reports/schema";

export const EventTypeSchema = z.enum([
  "client.created",
  "client.updated",
  "client.status_changed",
  "upload.received",
  "import.failed",
  "import.completed",
  "import.discarded",
  "report.published",
  "report.unpublished",
  "report.archived",
  "report.updated",
  "access.token_generated",
  "access.token_revoked",
  "access.disabled",
  "access.enabled",
  "auth.login",
  "auth.login_failed",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EventSchema = z.object({
  id: z.string(),
  type: EventTypeSchema,
  at: TimestampSchema,
  clientId: z.string().nullable(),
  actor: z.string().nullable(),
  summary: z.string(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});
export type PortalEvent = z.infer<typeof EventSchema>;

export const EVENT_LABEL: Record<EventType, string> = {
  "client.created": "Cliente cadastrado",
  "client.updated": "Cliente atualizado",
  "client.status_changed": "Status do cliente alterado",
  "upload.received": "Arquivo recebido",
  "import.failed": "Importação com erro",
  "import.completed": "Importação concluída",
  "import.discarded": "Importação descartada",
  "report.published": "Relatório publicado",
  "report.unpublished": "Publicação retirada",
  "report.archived": "Relatório arquivado",
  "report.updated": "Relatório atualizado",
  "access.token_generated": "Novo link gerado",
  "access.token_revoked": "Link revogado",
  "access.disabled": "Acesso desativado",
  "access.enabled": "Acesso reativado",
  "auth.login": "Login no painel",
  "auth.login_failed": "Tentativa de login recusada",
};
