"use client";

import { Ban, Power, RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/ui/confirm-action";
import { revokeTokenAction, rotateTokenAction, setAccessEnabledAction } from "@/features/clients/actions";

export function AccessActions({ clientId, hasToken, enabled }: { clientId: string; hasToken: boolean; enabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        action={() => rotateTokenAction(clientId)}
        variant={hasToken ? "secondary" : "primary"}
        icon={<RefreshCw className="size-4" aria-hidden />}
        confirm={{
          title: hasToken ? "Gerar novo link?" : "Gerar link de acesso?",
          description: hasToken ? "O link atual deixa de funcionar imediatamente. Você precisará enviar o novo endereço ao cliente." : "Um novo endereço exclusivo será criado para este cliente.",
          confirmLabel: "Gerar novo link",
          tone: hasToken ? "danger" : "primary",
        }}
      >
        Gerar novo link
      </ActionButton>
      {hasToken ? (
        <ActionButton
          action={() => revokeTokenAction(clientId)}
          variant="danger"
          icon={<Ban className="size-4" aria-hidden />}
          confirm={{ title: "Revogar link?", description: "O link atual para de funcionar e nenhum outro é criado. Para liberar o acesso de novo, gere um novo link.", confirmLabel: "Revogar link", tone: "danger" }}
        >
          Revogar link
        </ActionButton>
      ) : null}
      {enabled ? (
        <ActionButton
          action={() => setAccessEnabledAction(clientId, false)}
          variant="ghost"
          icon={<Power className="size-4" aria-hidden />}
          confirm={{ title: "Desativar acesso ao portal?", description: "O link continua o mesmo, mas fica bloqueado até você reativar. Útil para pausas temporárias.", confirmLabel: "Desativar acesso", tone: "danger" }}
        >
          Desativar acesso
        </ActionButton>
      ) : (
        <ActionButton action={() => setAccessEnabledAction(clientId, true)} variant="subtle" icon={<Power className="size-4" aria-hidden />}>
          Reativar acesso
        </ActionButton>
      )}
    </div>
  );
}
