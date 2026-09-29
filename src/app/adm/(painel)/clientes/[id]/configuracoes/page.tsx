import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ClientForm, type ClientFormValues } from "@/features/clients/components/client-form";
import { updateClientAction } from "@/features/clients/actions";
import { getClient } from "@/features/clients/service";
import { LogoUploader } from "@/features/admin/components/logo-uploader";
import { MaintenanceActions } from "@/features/admin/components/maintenance-actions";
import { DangerZone } from "@/features/admin/components/danger-zone";

export const metadata: Metadata = { title: "Configurações" };

export default async function ClientSettingsPage(props: PageProps<"/adm/clientes/[id]/configuracoes">) {
  const { id } = await props.params;
  const client = await getClient(id);
  if (!client) notFound();
  const initial: ClientFormValues = {
    name: client.name,
    shortName: client.shortName,
    slug: client.slug,
    greetingName: client.greetingName,
    segment: client.segment,
    currency: client.currency,
    notes: client.notes,
    roiMetric: client.dashboard.roiMetric,
    commercial: { ...client.modules.commercial },
    traffic: { ...client.modules.traffic },
  };
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <ClientForm action={updateClientAction.bind(null, client.id)} initial={initial} submitLabel="Salvar alterações" isEdit />
      </div>
      <div className="space-y-4 xl:col-span-4">
        <Card>
          <CardHeader title="Logo do cliente" subtitle="Opcional. PNG, JPG ou WebP até 1 MB." />
          <CardBody>
            <LogoUploader clientId={client.id} name={client.name} logoUrl={client.logo ? `/api/adm/clientes/${client.id}/logo?v=${encodeURIComponent(client.logo.updatedAt)}` : null} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Manutenção" subtitle="Ferramentas de recuperação" />
          <CardBody>
            <MaintenanceActions clientId={client.id} />
          </CardBody>
        </Card>
        <Card className="border-[rgb(255_123_139/0.25)]">
          <CardHeader title="Excluir cliente" subtitle="Ação permanente" />
          <CardBody>
            <DangerZone client={{ id: client.id, name: client.name, slug: client.slug }} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
