"use server";

import { revalidatePath } from "next/cache";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { requireAdmin } from "@/features/auth/session";
import { ContentSettingsInputSchema, type ContentSettingsInput } from "./schema";
import { refreshContent, saveContentSettings } from "./service";

function assertId(clientId: string) {
  if (!isValidId(clientId, "cl")) throw new Error("invalid client id");
}

export async function saveContentSettingsAction(clientId: string, input: ContentSettingsInput): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    assertId(clientId);
    const parsed = ContentSettingsInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revise as regras: algum valor está fora do permitido." };
    await saveContentSettings(clientId, parsed.data, session.email);
    revalidatePath(`/adm/clientes/${clientId}`, "layout");
    return { ok: true, data: undefined, message: "Regras salvas. O portal já usa as novas regras." };
  } catch (e) {
    return actionError(e, "content:save");
  }
}

export async function refreshContentAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    assertId(clientId);
    const { items } = await refreshContent(clientId);
    revalidatePath(`/adm/clientes/${clientId}`, "layout");
    return { ok: true, data: undefined, message: `Lista relida: ${items} ${items === 1 ? "item" : "itens"} no período.` };
  } catch (e) {
    return actionError(e, "content:refresh");
  }
}
