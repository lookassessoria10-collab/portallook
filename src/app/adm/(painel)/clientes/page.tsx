import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { env } from "@/lib/env";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/components/admin-shell";
import { ClientsTable } from "@/features/admin/components/clients-table";
import { buildClientRows } from "@/features/admin/client-rows";
import { listClientOverviews } from "@/features/clients/service";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage() {
  const rows = await buildClientRows(await listClientOverviews());
  return (
    <>
      <PageHeader
        title="Clientes"
        description="Status das entregas, última atualização e link de cada cliente."
        actions={
          <Link href="/adm/clientes/novo" className={buttonClass("primary")}>
            <UserPlus className="size-4" aria-hidden /> Novo cliente
          </Link>
        }
      />
      <ClientsTable rows={rows} timeZone={env().APP_TIMEZONE} />
    </>
  );
}
