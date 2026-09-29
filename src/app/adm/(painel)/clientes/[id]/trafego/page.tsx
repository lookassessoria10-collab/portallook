import type { Metadata } from "next";
import { ModuleReports } from "@/features/admin/components/module-reports";

export const metadata: Metadata = { title: "Tráfego" };

export default async function ClientTrafficPage(props: PageProps<"/adm/clientes/[id]/trafego">) {
  const { id } = await props.params;
  return <ModuleReports clientId={id} type="traffic" />;
}
