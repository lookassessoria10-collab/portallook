import type { Metadata } from "next";
import { ModuleReports } from "@/features/admin/components/module-reports";

export const metadata: Metadata = { title: "Comercial" };

export default async function ClientCommercialPage(props: PageProps<"/adm/clientes/[id]/comercial">) {
  const { id } = await props.params;
  return <ModuleReports clientId={id} type="commercial" />;
}
