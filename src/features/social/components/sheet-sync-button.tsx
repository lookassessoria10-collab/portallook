"use client";

import { RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/ui/confirm-action";
import { syncSocialSheetAction } from "@/features/social/sheet-actions";

export function SheetSyncButton({ clientId }: { clientId: string }) {
  return (
    <ActionButton action={() => syncSocialSheetAction(clientId)} variant="secondary" size="sm" icon={<RefreshCw className="size-4" aria-hidden />}>
      Sincronizar agora
    </ActionButton>
  );
}
