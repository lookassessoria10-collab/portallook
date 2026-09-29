import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/features/admin/components/admin-shell";
import { createClientAction } from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/components/client-form";

export const metadata: Metadata = { title: "Novo cliente" };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/adm/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-text-3 hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Clientes
      </Link>
      <PageHeader title="Novo cliente" description="O link exclusivo é gerado automaticamente ao salvar." />
      <ClientForm action={createClientAction} submitLabel="Cadastrar cliente" />
    </div>
  );
}
