import type { Metadata } from "next";
import { ModuleReports } from "@/features/admin/components/module-reports";

export const metadata: Metadata = { title: "Rede social" };

export default async function ClientSocialPage(props: PageProps<"/adm/clientes/[id]/rede-social">) {
  const { id } = await props.params;
  return <ModuleReports clientId={id} type="social" />;
}
