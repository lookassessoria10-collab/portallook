"use client";

import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/confirm-action";
import { deleteImportAction } from "@/features/uploads/actions";

/** Remove o upload da lista (registro + arquivo enviado). Relatórios já criados não são afetados. */
export function DeleteImportButton({ clientId, importId, fileName, imported }: { clientId: string; importId: string; fileName: string; imported: boolean }) {
  return (
    <ActionButton
      action={() => deleteImportAction(clientId, importId)}
      variant="ghost"
      size="icon"
      ariaLabel={`Excluir upload ${fileName}`}
      confirm={{
        title: "Excluir upload?",
        description: imported ? (
          <>
            <strong className="text-text">{fileName}</strong> sai da lista de uploads. Os relatórios criados a partir dele <strong className="text-text">continuam no painel</strong>, com o arquivo original guardado junto. Para tirar um relatório do portal, use Retirar publicação ou Arquivar na página dele.
          </>
        ) : (
          <>
            <strong className="text-text">{fileName}</strong> e o registro deste upload serão apagados definitivamente. Nenhum relatório é afetado.
          </>
        ),
        confirmLabel: "Excluir upload",
        tone: "danger",
      }}
    >
      <Trash2 className="size-4" aria-hidden />
    </ActionButton>
  );
}
