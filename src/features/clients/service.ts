import "server-only";
import { cache } from "react";
import { env } from "@/lib/env";
import { createId } from "@/lib/ids";
import { NotFoundError, UserFacingError } from "@/lib/errors";
import { todayISO } from "@/lib/dates/period";
import { logEvent } from "@/features/events/service";
import { computeDelivery, type DeliveryStatus } from "@/features/reports/delivery";
import { REPORT_TYPES, type ClientIndex, type ReportType } from "@/features/reports/schema";
import { getRepositories } from "@/server/repositories";
import type { ClientInput } from "./input";
import { MEDIA_PLAN_MODULE_DEFAULT, type Client, type ClientStatus } from "./schema";
import { ensureAccessToken } from "./access";

export const getClient = cache(async (clientId: string): Promise<Client | null> => getRepositories().clients.get(clientId));

export async function requireClient(clientId: string): Promise<Client> {
  const client = await getClient(clientId);
  if (!client) throw new NotFoundError("Cliente não encontrado.");
  return client;
}

export const listClients = cache(async () => getRepositories().clients.list());

export const getClientIndex = cache(async (clientId: string): Promise<ClientIndex> => getRepositories().reports.getIndex(clientId));

function modulesFromInput(input: ClientInput, current?: Client["modules"]): Client["modules"] {
  return { commercial: input.commercial, traffic: input.traffic, media_plan: input.media_plan ?? current?.media_plan ?? MEDIA_PLAN_MODULE_DEFAULT };
}

function requireSomeModule(input: ClientInput) {
  if (!input.commercial.enabled && !input.traffic.enabled && !input.media_plan?.enabled) {
    throw new UserFacingError("Ative pelo menos um módulo (Comercial, Tráfego ou Plano de mídia).");
  }
}

export async function createClient(input: ClientInput, actor: string | null): Promise<Client> {
  requireSomeModule(input);
  const now = new Date().toISOString();
  const client: Client = {
    id: createId("cl"),
    slug: input.slug,
    name: input.name,
    shortName: input.shortName,
    greetingName: input.greetingName,
    segment: input.segment,
    status: "active",
    logo: null,
    currency: input.currency,
    modules: modulesFromInput(input),
    dashboard: { roiMetric: input.roiMetric, highlightMetrics: [] },
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  const created = await getRepositories().clients.create(client);
  await ensureAccessToken(created.id, actor);
  await logEvent("client.created", { clientId: created.id, actor, summary: `Cliente ${created.name} cadastrado.` });
  return created;
}

export async function updateClient(clientId: string, input: ClientInput, actor: string | null): Promise<Client> {
  requireSomeModule(input);
  const updated = await getRepositories().clients.update(clientId, (c) => ({
    ...c,
    slug: input.slug,
    name: input.name,
    shortName: input.shortName,
    greetingName: input.greetingName,
    segment: input.segment,
    currency: input.currency,
    notes: input.notes,
    modules: modulesFromInput(input, c.modules),
    dashboard: { ...c.dashboard, roiMetric: input.roiMetric },
  }));
  await logEvent("client.updated", { clientId, actor, summary: `Dados de ${updated.name} atualizados.` });
  return updated;
}

export async function setClientStatus(clientId: string, status: ClientStatus, actor: string | null): Promise<Client> {
  const updated = await getRepositories().clients.update(clientId, (c) => ({ ...c, status }));
  const label = status === "active" ? "reativado" : status === "inactive" ? "desativado" : "arquivado";
  await logEvent("client.status_changed", { clientId, actor, summary: `Cliente ${updated.name} ${label}.`, meta: { status } });
  return updated;
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function updateClientLogo(clientId: string, file: { body: Buffer; contentType: string }, actor: string | null) {
  const extension = LOGO_TYPES[file.contentType];
  if (!extension) throw new UserFacingError("Envie o logo em PNG, JPG ou WebP.");
  if (file.body.length > 1024 * 1024) throw new UserFacingError("O logo precisa ter no máximo 1 MB.");
  if (!looksLikeImage(file.body, extension)) throw new UserFacingError("Este arquivo não parece ser uma imagem válida.");
  const repos = getRepositories();
  const path = await repos.clients.saveLogo(clientId, extension, file.body, file.contentType);
  await repos.clients.update(clientId, (c) => ({ ...c, logo: { path, contentType: file.contentType, updatedAt: new Date().toISOString() } }));
  await logEvent("client.updated", { clientId, actor, summary: "Logo atualizado." });
}

export async function removeClientLogo(clientId: string, actor: string | null) {
  await getRepositories().clients.update(clientId, (c) => ({ ...c, logo: null }));
  await logEvent("client.updated", { clientId, actor, summary: "Logo removido." });
}

function looksLikeImage(body: Buffer, ext: string): boolean {
  if (ext === "png") return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === "jpg") return body[0] === 0xff && body[1] === 0xd8;
  if (ext === "webp") return body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export interface ClientOverview {
  client: Client;
  index: ClientIndex;
  delivery: Record<ReportType, DeliveryStatus>;
  lastUpdatedAt: string | null;
  openImportErrors: number;
}

export function today(): string {
  return todayISO(env().APP_TIMEZONE);
}

export function buildOverview(client: Client, index: ClientIndex, date: string): ClientOverview {
  const delivery = {} as Record<ReportType, DeliveryStatus>;
  for (const type of REPORT_TYPES) {
    delivery[type] = computeDelivery({
      module: client.modules[type],
      reports: index.reports.filter((r) => r.type === type),
      imports: index.imports.filter((i) => i.reportType === type),
      today: date,
      clientSince: client.createdAt,
      planning: type === "media_plan",
    });
  }
  const timestamps = index.reports.map((r) => r.publishedAt).filter((t): t is string => Boolean(t));
  const lastUpdatedAt = timestamps.sort().at(-1) ?? null;
  const openImportErrors = index.imports.filter((i) => i.status === "invalid" || i.status === "failed").length;
  return { client, index, delivery, lastUpdatedAt, openImportErrors };
}

export const getClientOverview = cache(async (clientId: string): Promise<ClientOverview | null> => {
  const client = await getClient(clientId);
  if (!client) return null;
  return buildOverview(client, await getClientIndex(clientId), today());
});

export const listClientOverviews = cache(async (): Promise<ClientOverview[]> => {
  const clients = await listClients();
  const date = today();
  const indexes = await Promise.all(clients.map((c) => getClientIndex(c.id)));
  return clients.map((c, i) => buildOverview(c, indexes[i], date));
});
