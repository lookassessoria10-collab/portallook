"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { requireAdmin } from "@/features/auth/session";
import { clientInputFromForm, ClientInputSchema, fieldErrorsFrom } from "./input";
import { createClient, removeClientLogo, setClientStatus, updateClient, updateClientLogo } from "./service";
import { revokeAccessToken, rotateAccessToken, setAccessEnabled } from "./access";

export interface ClientFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

function assertId(id: string) {
  if (!isValidId(id, "cl")) throw new Error("invalid id");
}

export async function createClientAction(_prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  const session = await requireAdmin();
  const parsed = ClientInputSchema.safeParse(clientInputFromForm(form));
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  let id: string;
  try {
    const client = await createClient(parsed.data, session.email);
    id = client.id;
  } catch (e) {
    return actionError(e, "client:create");
  }
  revalidatePath("/adm", "layout");
  redirect(`/adm/clientes/${id}?novo=1`);
}

export async function updateClientAction(clientId: string, _prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  const session = await requireAdmin();
  assertId(clientId);
  const parsed = ClientInputSchema.safeParse(clientInputFromForm(form));
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    await updateClient(clientId, parsed.data, session.email);
  } catch (e) {
    return actionError(e, "client:update");
  }
  revalidatePath("/adm", "layout");
  return { ok: true };
}

export async function setClientStatusAction(clientId: string, status: "active" | "inactive" | "archived"): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertId(clientId);
    await setClientStatus(clientId, status, session.email);
    revalidatePath("/adm", "layout");
    const message = status === "active" ? "Cliente reativado." : status === "inactive" ? "Cliente desativado. O portal fica indisponível." : "Cliente arquivado.";
    return { ok: true, data: undefined, message };
  } catch (e) {
    return actionError(e, "client:status");
  }
}

export async function rotateTokenAction(clientId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertId(clientId);
    await rotateAccessToken(clientId, session.email);
    revalidatePath(`/adm/clientes/${clientId}`, "layout");
    return { ok: true, data: undefined, message: "Novo link gerado. O link anterior deixou de funcionar." };
  } catch (e) {
    return actionError(e, "access:rotate");
  }
}

export async function revokeTokenAction(clientId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertId(clientId);
    await revokeAccessToken(clientId, session.email);
    revalidatePath(`/adm/clientes/${clientId}`, "layout");
    return { ok: true, data: undefined, message: "Link revogado. Gere um novo link quando quiser reativar." };
  } catch (e) {
    return actionError(e, "access:revoke");
  }
}

export async function setAccessEnabledAction(clientId: string, enabled: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertId(clientId);
    await setAccessEnabled(clientId, enabled, session.email);
    revalidatePath(`/adm/clientes/${clientId}`, "layout");
    return { ok: true, data: undefined, message: enabled ? "Acesso ao portal reativado." : "Acesso ao portal desativado." };
  } catch (e) {
    return actionError(e, "access:toggle");
  }
}

export async function uploadLogoAction(clientId: string, form: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertId(clientId);
    const file = form.get("logo");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecione uma imagem." };
    await updateClientLogo(clientId, { body: Buffer.from(await file.arrayBuffer()), contentType: file.type }, session.email);
    revalidatePath(`/adm/clientes/${clientId}`, "layout");
    return { ok: true, data: undefined, message: "Logo atualizado." };
  } catch (e) {
    return actionError(e, "client:logo");
  }
}

export async function removeLogoAction(clientId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertId(clientId);
    await removeClientLogo(clientId, session.email);
    revalidatePath(`/adm/clientes/${clientId}`, "layout");
    return { ok: true, data: undefined, message: "Logo removido." };
  } catch (e) {
    return actionError(e, "client:logo-remove");
  }
}
