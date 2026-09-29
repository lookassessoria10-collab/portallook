import Link from "next/link";
import { LookLogo } from "@/components/brand/look-logo";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <LookLogo width={104} />
      <div>
        <h1 className="text-xl font-bold text-text">Página não encontrada</h1>
        <p className="mt-2 text-sm text-text-2">O endereço acessado não existe ou não está mais disponível.</p>
      </div>
      <Link href="/" className={buttonClass("secondary")}>
        Ir para o início
      </Link>
    </main>
  );
}
