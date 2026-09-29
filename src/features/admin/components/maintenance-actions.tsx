"use client";

import { DatabaseZap } from "lucide-react";
import { ActionButton } from "@/components/ui/confirm-action";
import { rebuildIndexAction } from "@/features/reports/actions";

export function MaintenanceActions({ clientId }: { clientId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-text-3">
        Recalcula o índice e os indicadores de todos os relatórios deste cliente a partir dos arquivos salvos. Use se algo parecer desatualizado nas listas ou no histórico.
      </p>
      <ActionButton action={() => rebuildIndexAction(clientId)} size="sm" icon={<DatabaseZap className="size-4" aria-hidden />}>
        Reconstruir índice
      </ActionButton>
    </div>
  );
}
