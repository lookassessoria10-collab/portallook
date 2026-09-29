"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ClientAvatar } from "@/components/brand/client-avatar";
import { removeLogoAction, uploadLogoAction } from "@/features/clients/actions";

export function LogoUploader({ clientId, name, logoUrl }: { clientId: string; name: string; logoUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const upload = (file: File) =>
    start(async () => {
      const form = new FormData();
      form.set("logo", file);
      const res = await uploadLogoAction(clientId, form);
      if (res.ok) {
        toast.success(res.message ?? "Logo atualizado.");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="flex items-center gap-4">
      <ClientAvatar name={name} logoUrl={logoUrl} size={64} />
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Selecionar logo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <Button size="sm" onClick={() => input.current?.click()} disabled={pending}>
          <ImageUp className="size-4" aria-hidden /> {logoUrl ? "Trocar" : "Enviar logo"}
        </Button>
        {logoUrl ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await removeLogoAction(clientId);
                if (res.ok) {
                  toast.success(res.message ?? "Logo removido.");
                  router.refresh();
                } else toast.error(res.error);
              })
            }
          >
            <Trash2 className="size-4" aria-hidden /> Remover
          </Button>
        ) : null}
      </div>
    </div>
  );
}
