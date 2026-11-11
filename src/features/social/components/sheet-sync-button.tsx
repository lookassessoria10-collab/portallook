"use client";

import { RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/ui/confirm-action";
import { syncSocialSheetAction } from "@/features/social/sheet-actions";

export function SheetSyncButton({ clientId }: { clientId: string }) {
  return (
    <ActionButton
      action={() => syncSocialSheetAction(clientId)}
      variant="secondary"
      size="sm"
      icon={<RefreshCw className="size-4" aria-hidden />}
      confirm={{
        title: "Sincronizar com a planilha?",
        description:
          "Lê a planilha agora para todos os clientes com Rede social: publica os meses novos e troca os meses já publicados que mudaram na planilha. A versão anterior de cada mês trocado fica no histórico, e o título e os insights do mês são mantidos.",
        confirmLabel: "Sincronizar",
        tone: "primary",
      }}
    >
      Sincronizar agora
    </ActionButton>
  );
}
