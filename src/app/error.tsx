"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Erro inesperado: mensagem humana na tela, detalhes técnicos só no console. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div>
        <h1 className="text-xl font-bold text-text">Não foi possível carregar esta página</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-2">Algo deu errado do nosso lado. Tente novamente em instantes.</p>
        {error.digest ? <p className="mt-3 text-xs text-text-3">Código de referência: {error.digest}</p> : null}
      </div>
      <Button variant="primary" onClick={reset}>
        <RefreshCw className="size-4" aria-hidden /> Tentar novamente
      </Button>
    </main>
  );
}
