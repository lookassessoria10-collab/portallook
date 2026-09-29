"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { deleteClientAction } from "@/features/clients/actions";

/**
 * Exclusão definitiva com confirmação explícita: é preciso digitar o endereço
 * (slug) do cliente. Para pausas, a opção reversível continua sendo "Desativar".
 */
export function DeleteClientDialog({
  client,
  open,
  onClose,
  onDeleted,
}: {
  client: { id: string; name: string; slug: string } | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  // Limpa a confirmação ao fechar, para a próxima abertura começar vazia.
  const close = () => {
    setTyped("");
    onClose();
  };

  if (!client) return null;
  const matches = typed.trim().toLowerCase() === client.slug;

  const confirm = () =>
    start(async () => {
      const res = await deleteClientAction(client.id, typed);
      if (res.ok) {
        toast.success(res.message ?? "Cliente excluído.");
        close();
        onDeleted();
      } else toast.error(res.error);
    });

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Excluir ${client.name}?`}
      size="sm"
      description={
        <>
          Isto apaga <strong className="text-text">definitivamente</strong> todos os relatórios, arquivos originais, logo e o link do cliente. Não é possível desfazer. Se for só uma pausa, use <strong className="text-text">Desativar</strong>.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!matches || pending} aria-busy={pending}>
            <Trash2 className="size-4" aria-hidden />
            {pending ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </>
      }
    >
      <Field label={`Para confirmar, digite ${client.slug}`} htmlFor={`confirm-delete-${client.id}`}>
        <Input
          id={`confirm-delete-${client.id}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={client.slug}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches && !pending) confirm();
          }}
        />
      </Field>
    </Dialog>
  );
}
