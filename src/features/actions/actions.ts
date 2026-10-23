"use server";

import { revalidatePath } from "next/cache";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { requireAdmin } from "@/features/auth/session";
import { ACTION_ID_PATTERN, ActionInputSchema, type ActionInput } from "./schema";
import { deleteAction, importActionsFromSheet, saveAction, setActionsEnabled, setActionVisible } from "./service";

function assertIds(clientId: string, actionId?: string) {
  if (!isValidId(clientId, "cl")) throw new Error("invalid client id");
  if (actionId !== undefined && !ACTION_ID_PATTERN.test(actionId)) throw new Error("invalid action id");
}

function revalidate(clientId: string) {
  revalidatePath(`/adm/clientes/${clientId}`, "layout");
  revalidatePath("/adm/acoes");
}

export async function saveActionAction(clientId: string, input: ActionInput): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertIds(clientId);
    const parsed = ActionInputSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? "form"), i.message]));
      return { ok: false, error: "Revise os campos destacados.", fieldErrors };
    }
    await saveAction(clientId, parsed.data, session.email);
    revalidate(clientId);
    return { ok: true, data: undefined, message: input.id ? "Ação atualizada." : "Ação adicionada." };
  } catch (e) {
    return actionError(e, "actions:save");
  }
}

export async function deleteActionAction(clientId: string, actionId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertIds(clientId, actionId);
    await deleteAction(clientId, actionId, session.email);
    revalidate(clientId);
    return { ok: true, data: undefined, message: "Ação removida." };
  } catch (e) {
    return actionError(e, "actions:delete");
  }
}

export async function setActionVisibleAction(clientId: string, actionId: string, visible: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertIds(clientId, actionId);
    await setActionVisible(clientId, actionId, Boolean(visible), session.email);
    revalidate(clientId);
    return { ok: true, data: undefined, message: visible ? "A ação voltou a aparecer no portal." : "A ação ficou só no painel da Look." };
  } catch (e) {
    return actionError(e, "actions:visibility");
  }
}

export async function setActionsEnabledAction(clientId: string, enabled: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertIds(clientId);
    await setActionsEnabled(clientId, Boolean(enabled), session.email);
    revalidate(clientId);
    return { ok: true, data: undefined, message: enabled ? "A área Ações aparece no portal do cliente." : "A área Ações foi escondida do portal." };
  } catch (e) {
    return actionError(e, "actions:enabled");
  }
}

export async function importActionsSheetAction(clientId: string, sheetName: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertIds(clientId);
    const count = await importActionsFromSheet(clientId, String(sheetName ?? "").slice(0, 120), session.email);
    revalidate(clientId);
    return { ok: true, data: undefined, message: `${count} ${count === 1 ? "ação importada" : "ações importadas"} da planilha.` };
  } catch (e) {
    return actionError(e, "actions:import");
  }
}
