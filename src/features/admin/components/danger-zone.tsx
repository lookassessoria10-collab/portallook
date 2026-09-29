"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteClientDialog } from "./delete-client-dialog";

export function DangerZone({ client }: { client: { id: string; name: string; slug: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-text-3">Excluir apaga definitivamente relatórios, arquivos, logo e o link deste cliente. Para uma pausa, prefira “Desativar”, no topo da página.</p>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> Excluir cliente
      </Button>
      <DeleteClientDialog client={client} open={open} onClose={() => setOpen(false)} onDeleted={() => router.push("/adm/clientes")} />
    </div>
  );
}
