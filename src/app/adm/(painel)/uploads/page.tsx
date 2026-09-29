import type { Metadata } from "next";
import { UploadCloud } from "lucide-react";
import { env } from "@/lib/env";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/features/admin/components/admin-shell";
import { ImportList } from "@/features/admin/components/import-list";
import { toWizardClients } from "@/features/admin/wizard-clients";
import { listClientOverviews, today } from "@/features/clients/service";
import { UploadWizard } from "@/features/uploads/components/upload-wizard";

export const metadata: Metadata = { title: "Uploads" };

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : null;
}

export default async function UploadsPage(props: PageProps<"/adm/uploads">) {
  const search = await props.searchParams;
  const overviews = await listClientOverviews();
  const tipo = one(search.tipo);
  const recent = overviews
    .flatMap((o) => o.index.imports.map((i) => ({ ...i, clientName: o.client.name })))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 15);

  return (
    <>
      <PageHeader title="Enviar relatório" description="Planilhas viram dashboard; PDF e HTML ficam disponíveis como documento. Tudo entra como rascunho." />
      <div className="grid gap-6 2xl:grid-cols-12">
        <div className="2xl:col-span-8">
          <UploadWizard
            clients={toWizardClients(overviews)}
            today={today()}
            maxMb={env().UPLOAD_MAX_MB}
            initial={{ clientId: one(search.cliente), type: tipo === "commercial" || tipo === "traffic" ? tipo : null, periodKey: one(search.periodo) }}
          />
        </div>
        <Card className="h-fit 2xl:col-span-4">
          <CardHeader title="Últimos uploads" subtitle="Inclui arquivos com erro" />
          <CardBody>{recent.length ? <ImportList imports={recent} timeZone={env().APP_TIMEZONE} showClient /> : <EmptyState compact icon={<UploadCloud />} title="Nenhum upload ainda" />}</CardBody>
        </Card>
      </div>
    </>
  );
}
