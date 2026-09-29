import { isValidId, SLUG_PATTERN } from "@/lib/ids";
import type { ReportType } from "@/features/reports/schema";

/**
 * Organização previsível do armazenamento:
 *
 *   clients/{clientId}/client.json            perfil e configuração
 *   clients/{clientId}/access.json            token do link (hash + cifrado)
 *   clients/{clientId}/index.json             resumo de relatórios e imports (reconstruível)
 *   clients/{clientId}/logo.{ext}
 *   clients/{clientId}/reports/{type}/{reportId}/manifest.json
 *   clients/{clientId}/reports/{type}/{reportId}/data.json
 *   clients/{clientId}/reports/{type}/{reportId}/original.{ext}
 *   slugs/{slug}.json                         slug → clientId (reserva atômica)
 *   imports/{importId}/record.json|original.{ext}|parsed.json
 *   events/{yyyy}/{mm}/{timestamp}_{eventId}.json
 *
 * Todo segmento variável é validado aqui — nunca vem direto do usuário.
 */
function id(value: string, prefix: string): string {
  if (!isValidId(value, prefix)) throw new Error(`Identificador inválido: ${value}`);
  return value;
}

const EXT = /^[a-z0-9]{2,5}$/;
function ext(value: string): string {
  if (!EXT.test(value)) throw new Error(`Extensão inválida: ${value}`);
  return value;
}

export const paths = {
  clientsPrefix: () => "clients/",
  clientDir: (clientId: string) => `clients/${id(clientId, "cl")}`,
  client: (clientId: string) => `${paths.clientDir(clientId)}/client.json`,
  access: (clientId: string) => `${paths.clientDir(clientId)}/access.json`,
  clientIndex: (clientId: string) => `${paths.clientDir(clientId)}/index.json`,
  clientLogo: (clientId: string, extension: string) => `${paths.clientDir(clientId)}/logo.${ext(extension)}`,
  reportsPrefix: (clientId: string) => `${paths.clientDir(clientId)}/reports/`,
  reportDir: (clientId: string, type: ReportType, reportId: string) => `${paths.clientDir(clientId)}/reports/${type}/${id(reportId, "rp")}`,
  reportManifest: (clientId: string, type: ReportType, reportId: string) => `${paths.reportDir(clientId, type, reportId)}/manifest.json`,
  reportData: (clientId: string, type: ReportType, reportId: string) => `${paths.reportDir(clientId, type, reportId)}/data.json`,
  reportOriginal: (clientId: string, type: ReportType, reportId: string, extension: string) =>
    `${paths.reportDir(clientId, type, reportId)}/original.${ext(extension)}`,
  slug: (slug: string) => {
    if (!SLUG_PATTERN.test(slug) || slug.length > 48) throw new Error(`Slug inválido: ${slug}`);
    return `slugs/${slug}.json`;
  },
  importDir: (importId: string) => `imports/${id(importId, "im")}`,
  importRecord: (importId: string) => `${paths.importDir(importId)}/record.json`,
  importOriginal: (importId: string, extension: string) => `${paths.importDir(importId)}/original.${ext(extension)}`,
  importParsed: (importId: string) => `${paths.importDir(importId)}/parsed.json`,
  eventsPrefix: (year: number, month: number) => `events/${year}/${String(month).padStart(2, "0")}/`,
  /** O clientId vai no nome para permitir filtrar a listagem sem abrir cada arquivo. */
  event: (at: Date, eventId: string, clientId: string | null) =>
    `${paths.eventsPrefix(at.getUTCFullYear(), at.getUTCMonth() + 1)}${at.toISOString().replace(/[-:.]/g, "")}_${clientId ? id(clientId, "cl") : "global"}_${id(eventId, "ev")}.json`,
};
