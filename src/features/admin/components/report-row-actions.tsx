"use client";

import { Eye, EyeOff, Send } from "lucide-react";
import { ActionButton } from "@/components/ui/confirm-action";
import { reportStatusAction } from "@/features/reports/actions";
import type { ReportStatus } from "@/features/reports/schema";

/** Publicar / retirar direto da lista — sempre com confirmação explícita. */
export function ReportQuickAction({ clientId, reportId, status, label }: { clientId: string; reportId: string; status: ReportStatus; label: string }) {
  if (status === "draft" || status === "unpublished") {
    return (
      <ActionButton
        action={() => reportStatusAction(clientId, reportId, "publish")}
        variant="subtle"
        size="sm"
        icon={<Send className="size-3.5" aria-hidden />}
        confirm={{ title: "Publicar relatório?", description: `${label} ficará visível para o cliente no portal. Se houver outra versão publicada do mesmo período, ela será substituída (e continuará no histórico).`, confirmLabel: "Publicar", tone: "primary" }}
      >
        Publicar
      </ActionButton>
    );
  }
  if (status === "published") {
    return (
      <ActionButton
        action={() => reportStatusAction(clientId, reportId, "unpublish")}
        variant="ghost"
        size="sm"
        icon={<EyeOff className="size-3.5" aria-hidden />}
        confirm={{ title: "Retirar publicação?", description: `${label} deixará de aparecer para o cliente. Nada é apagado; você pode publicar de novo depois.`, confirmLabel: "Retirar do portal", tone: "danger" }}
      >
        Retirar
      </ActionButton>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-3">
      <Eye className="size-3.5" aria-hidden /> Somente histórico
    </span>
  );
}
