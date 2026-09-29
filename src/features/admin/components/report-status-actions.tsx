"use client";

import { Archive, EyeOff, RotateCcw, Send } from "lucide-react";
import { ActionButton } from "@/components/ui/confirm-action";
import { reportStatusAction } from "@/features/reports/actions";
import type { ReportStatus } from "@/features/reports/schema";

export function ReportStatusActions({ clientId, reportId, status, label }: { clientId: string; reportId: string; status: ReportStatus; label: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" || status === "unpublished" ? (
        <ActionButton
          action={() => reportStatusAction(clientId, reportId, "publish")}
          variant="primary"
          icon={<Send className="size-4" aria-hidden />}
          confirm={{
            title: "Publicar relatório?",
            description: `${label} ficará visível para o cliente. Se já houver uma versão publicada deste período, ela passa a "substituída" e continua no histórico.`,
            confirmLabel: "Publicar agora",
            tone: "primary",
          }}
        >
          Publicar
        </ActionButton>
      ) : null}
      {status === "published" ? (
        <ActionButton
          action={() => reportStatusAction(clientId, reportId, "unpublish")}
          variant="secondary"
          icon={<EyeOff className="size-4" aria-hidden />}
          confirm={{ title: "Retirar publicação?", description: `${label} deixará de aparecer para o cliente. Nada é apagado.`, confirmLabel: "Retirar do portal", tone: "danger" }}
        >
          Retirar publicação
        </ActionButton>
      ) : null}
      {status === "archived" || status === "superseded" || status === "unpublished" ? (
        <ActionButton action={() => reportStatusAction(clientId, reportId, "restore")} variant="ghost" icon={<RotateCcw className="size-4" aria-hidden />}>
          Voltar para rascunho
        </ActionButton>
      ) : null}
      {status !== "archived" ? (
        <ActionButton
          action={() => reportStatusAction(clientId, reportId, "archive")}
          variant="ghost"
          icon={<Archive className="size-4" aria-hidden />}
          confirm={{ title: "Arquivar relatório?", description: "Ele sai do portal e das listas principais, mas os arquivos e dados são preservados. Você pode restaurar depois.", confirmLabel: "Arquivar", tone: "danger" }}
        >
          Arquivar
        </ActionButton>
      ) : null}
    </div>
  );
}
