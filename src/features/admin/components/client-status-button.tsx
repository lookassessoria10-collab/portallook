"use client";

import { Power } from "lucide-react";
import { ActionButton } from "@/components/ui/confirm-action";
import { setClientStatusAction } from "@/features/clients/actions";

export function ClientStatusButton({ clientId, status, name }: { clientId: string; status: "active" | "inactive" | "archived"; name: string }) {
  if (status === "active") {
    return (
      <ActionButton
        action={() => setClientStatusAction(clientId, "inactive")}
        variant="ghost"
        size="sm"
        icon={<Power className="size-4" aria-hidden />}
        confirm={{
          title: `Desativar ${name}?`,
          description: "O portal do cliente fica indisponível e ele deixa de aparecer nas pendências. Nenhum dado é apagado — você pode reativar a qualquer momento.",
          confirmLabel: "Desativar cliente",
          tone: "danger",
        }}
      >
        Desativar
      </ActionButton>
    );
  }
  return (
    <ActionButton action={() => setClientStatusAction(clientId, "active")} variant="subtle" size="sm" icon={<Power className="size-4" aria-hidden />}>
      Reativar
    </ActionButton>
  );
}
