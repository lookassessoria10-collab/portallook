"use server";

import { revalidatePath } from "next/cache";
import { actionError, type ActionResult } from "@/lib/errors";
import { isValidId } from "@/lib/ids";
import { requireAdmin } from "@/features/auth/session";
import { describeMonths, syncSocialSheet } from "./sheet-sync";

/** "Sincronizar agora": relê a planilha Google na hora (todos os clientes) e conta o que entrou para este. */
export async function syncSocialSheetAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    if (!isValidId(clientId, "cl")) throw new Error("invalid client id");
    const result = await syncSocialSheet({ force: true });
    revalidatePath("/adm", "layout");
    if (!result.ran) return { ok: false, error: "Uma leitura da planilha já está em andamento. Tente de novo em instantes." };
    if (result.error) return { ok: false, error: result.error };
    const mine = result.created[clientId] ?? [];
    const problem = result.clients[clientId]?.problem ?? null;
    if (problem) return { ok: false, error: problem };
    return { ok: true, data: undefined, message: mine.length ? `Planilha lida. Publicado: ${describeMonths(mine)}.` : "Planilha lida. Nenhum mês novo para este cliente." };
  } catch (e) {
    return actionError(e, "social-sheet:sync");
  }
}
