import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { env } from "@/lib/env";
import { isValidId } from "@/lib/ids";
import { PageHeader } from "@/features/admin/components/admin-shell";
import { toWizardClients } from "@/features/admin/wizard-clients";
import { listClientOverviews, today } from "@/features/clients/service";
import { UploadWizard } from "@/features/uploads/components/upload-wizard";
import { getRepositories } from "@/server/repositories";
import { IMPORT_STATUS_LABEL } from "@/features/uploads/schema";
import { ImportStatusBadge } from "@/components/dashboard/status-badge";
import { ValidationList } from "@/features/uploads/components/validation-list";

export const metadata: Metadata = { title: "Upload" };

/** Reabre uma importação (ex.: com erro) para revisar, confirmar ou descartar. */
export default async function ImportPage(props: PageProps<"/adm/uploads/[importId]">) {
  const { importId } = await props.params;
  if (!isValidId(importId, "im")) notFound();
  const record = await getRepositories().imports.get(importId);
  if (!record) notFound();
  const overviews = await listClientOverviews();
  const clientName = overviews.find((o) => o.client.id === record.clientId)?.client.name ?? "Cliente";
  const resumable = record.status === "validated" || record.status === "invalid" || record.status === "imported";

  return (
    <>
      <Link href="/adm/uploads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-text-3 hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Uploads
      </Link>
      <PageHeader title={record.fileName} description={`${clientName} · ${IMPORT_STATUS_LABEL[record.status]}`} actions={<ImportStatusBadge status={record.status} />} />
      {resumable ? (
        <UploadWizard clients={toWizardClients(overviews)} today={today()} maxMb={env().UPLOAD_MAX_MB} resume={record} />
      ) : (
        <div className="card p-6">
          <p className="text-sm text-text-2">Esta importação está {IMPORT_STATUS_LABEL[record.status].toLowerCase()} e não pode mais ser retomada.</p>
          {record.issues.length ? <div className="mt-4"><ValidationList issues={record.issues} /></div> : null}
        </div>
      )}
    </>
  );
}
