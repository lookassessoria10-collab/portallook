"use server";

import { revalidatePath } from "next/cache";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { requireAdmin } from "@/features/auth/session";
import { describeMonths, syncSocialSheet } from "./sheet-sync";

/**
 * "Sincronizar agora": relê a planilha Google na hora (todos os clientes), publica os meses novos e
 * troca os meses publicados que mudaram na planilha. Conta o que mudou para este cliente.
 */
export async function syncSocialSheetAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    if (!isValidId(clientId, "cl")) throw new Error("invalid client id");
    const result = await syncSocialSheet({ force: true, replaceChanged: true });
    revalidatePath("/adm", "layout");
    if (!result.ran) return { ok: false, error: "Uma leitura da planilha já está em andamento. Tente de novo em instantes." };
    if (result.error) return { ok: false, error: result.error };
    const problem = result.clients[clientId]?.problem ?? null;
    if (problem) return { ok: false, error: problem };
    const fresh = result.created[clientId] ?? [];
    const swapped = result.replaced[clientId] ?? [];
    const parts = [fresh.length ? `Publicado: ${describeMonths(fresh)}.` : "", swapped.length ? `Atualizado pela planilha: ${describeMonths(swapped)}.` : ""].filter(Boolean);
    return { ok: true, data: undefined, message: parts.length ? `Planilha lida. ${parts.join(" ")}` : "Planilha lida. Nada mudou para este cliente." };
  } catch (e) {
    return actionError(e, "social-sheet:sync");
  }
}
