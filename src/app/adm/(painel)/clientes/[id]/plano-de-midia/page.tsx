import type { Metadata } from "next";
import { ModuleReports } from "@/features/admin/components/module-reports";

export const metadata: Metadata = { title: "Plano de mídia" };

export default async function ClientMediaPlanPage(props: PageProps<"/adm/clientes/[id]/plano-de-midia">) {
  const { id } = await props.params;
  return <ModuleReports clientId={id} type="media_plan" />;
}
