import { LinkIcon } from "lucide-react";
import { LookLogo } from "@/components/brand/look-logo";

/** Mesma resposta para slug inexistente, token errado ou revogado — não revela nada. */
export default function PortalNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <LookLogo width={104} />
      <div className="grid size-14 place-items-center rounded-2xl border border-border-strong bg-surface text-text-3" aria-hidden>
        <LinkIcon className="size-6" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-text">Link indisponível</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-2">Este link não é válido ou foi substituído por um novo. Fale com a equipe da Look para receber o endereço atualizado.</p>
      </div>
    </main>
  );
}
