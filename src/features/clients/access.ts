import "server-only";
import { env } from "@/lib/env";
import { ACCESS_TOKEN_PATTERN, decryptToken, encryptToken, generateAccessToken, hashAccessToken, tokenHint, verifyAccessToken } from "@/lib/crypto/tokens";
import { SLUG_PATTERN } from "@/lib/ids";
import { logEvent } from "@/features/events/service";
import { getRepositories } from "@/server/repositories";
import type { Client, ClientAccess } from "./schema";

const MAX_HISTORY = 20;

function withHistory(access: ClientAccess, action: ClientAccess["history"][number]["action"], hint: string | null): ClientAccess {
  const at = new Date().toISOString();
  return { ...access, updatedAt: at, history: [{ action, at, hint }, ...access.history].slice(0, MAX_HISTORY) };
}

function blankAccess(clientId: string): ClientAccess {
  return { clientId, enabled: true, token: null, updatedAt: new Date().toISOString(), history: [] };
}

/**
 * Gera um novo token (o anterior deixa de funcionar imediatamente).
 * Retorna o token em texto puro apenas para montar o link.
 */
export async function rotateAccessToken(clientId: string, actor: string | null): Promise<string> {
  const token = generateAccessToken();
  const hint = tokenHint(token);
  await getRepositories().access.update(clientId, (current) => {
    const base = current ?? blankAccess(clientId);
    return withHistory(
      { ...base, token: { hash: hashAccessToken(token), ciphertext: encryptToken(token), hint, createdAt: new Date().toISOString() } },
      "generated",
      hint,
    );
  });
  await logEvent("access.token_generated", { clientId, actor, summary: `Novo link gerado (final …${hint}).`, meta: { hint } });
  return token;
}

export async function ensureAccessToken(clientId: string, actor: string | null): Promise<void> {
  const current = await getRepositories().access.get(clientId);
  if (!current?.token) await rotateAccessToken(clientId, actor);
}

export async function revokeAccessToken(clientId: string, actor: string | null): Promise<void> {
  let hint: string | null = null;
  await getRepositories().access.update(clientId, (current) => {
    const base = current ?? blankAccess(clientId);
    hint = base.token?.hint ?? null;
    return withHistory({ ...base, token: null }, "revoked", hint);
  });
  await logEvent("access.token_revoked", { clientId, actor, summary: hint ? `Link revogado (final …${hint}).` : "Link revogado." });
}

export async function setAccessEnabled(clientId: string, enabled: boolean, actor: string | null): Promise<void> {
  await getRepositories().access.update(clientId, (current) => withHistory({ ...(current ?? blankAccess(clientId)), enabled }, enabled ? "enabled" : "disabled", null));
  await logEvent(enabled ? "access.enabled" : "access.disabled", { clientId, actor, summary: enabled ? "Acesso ao portal reativado." : "Acesso ao portal desativado." });
}

export function portalBaseUrl(): string {
  const configured = env().PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function buildPortalPath(slug: string, token: string): string {
  return `/c/${slug}/${token}`;
}

export interface PortalLinkInfo {
  access: ClientAccess | null;
  url: string | null;
  path: string | null;
}

/** Recupera o link atual para o ADM copiar (o token é guardado cifrado). */
export async function getPortalLink(client: Client): Promise<PortalLinkInfo> {
  const access = await getRepositories().access.get(client.id);
  if (!access?.token) return { access, url: null, path: null };
  const token = decryptToken(access.token.ciphertext);
  if (!token) return { access, url: null, path: null };
  const p = buildPortalPath(client.slug, token);
  return { access, url: `${portalBaseUrl()}${p}`, path: p };
}

/**
 * Valida o acesso do cliente no servidor. Qualquer falha (slug inexistente,
 * token errado, revogado, cliente inativo) produz o mesmo resultado — `null` —
 * para não revelar quais clientes existem.
 */
export async function resolvePortalAccess(slug: string, token: string): Promise<Client | null> {
  if (!SLUG_PATTERN.test(slug) || !ACCESS_TOKEN_PATTERN.test(token)) return null;
  const repos = getRepositories();
  const client = await repos.clients.getBySlug(slug);
  const access = client ? await repos.access.get(client.id) : null;
  // Sempre calcula o HMAC, mesmo sem cliente, para o tempo de resposta não indicar se o slug existe.
  const valid = verifyAccessToken(token, access?.token?.hash ?? DUMMY_HASH);
  if (!client || client.status !== "active" || !access?.enabled || !access.token) return null;
  return valid ? client : null;
}

const DUMMY_HASH = "0".repeat(64);
