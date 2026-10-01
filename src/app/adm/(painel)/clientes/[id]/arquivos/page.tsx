import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FolderOpen, UploadCloud } from "lucide-react";
import { env } from "@/lib/env";
import { formatDateTime, formatPeriod } from "@/lib/dates/period";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/button";
import { ReportStatusBadge } from "@/components/dashboard/status-badge";
import { ImportList } from "@/features/admin/components/import-list";
import { getClientOverview } from "@/features/clients/service";
import { REPORT_TYPE_LABEL, SOURCE_TYPE_LABEL } from "@/features/reports/schema";

export const metadata: Metadata = { title: "Arquivos" };

export default async function ClientFilesPage(props: PageProps<"/adm/clientes/[id]/arquivos">) {
  const { id } = await props.params;
  const o = await getClientOverview(id);
  if (!o) notFound();
  const tz = env().APP_TIMEZONE;
  const originals = o.index.reports.filter((r) => r.sourceType && r.sourceType !== "seed");

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Uploads"
          subtitle="Arquivos enviados, validados ou com erro"
          actions={
            <Link href={`/adm/uploads?cliente=${id}`} className={buttonClass("secondary", "sm")}>
              <UploadCloud className="size-4" aria-hidden /> Novo upload
            </Link>
          }
        />
        <CardBody>{o.index.imports.length ? <ImportList imports={o.index.imports.map((i) => ({ ...i, clientId: id }))} timeZone={tz} /> : <EmptyState compact icon={<UploadCloud />} title="Nenhum upload registrado" />}</CardBody>
      </Card>
      <Card>
        <CardHeader title="Arquivos originais" subtitle="Preservados junto de cada relatório" />
        <CardBody>
          {originals.length ? (
            <ul className="divide-y divide-border">
              {originals.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/adm/clientes/${id}/relatorios/${r.id}`} className="block truncate text-sm font-bold text-text hover:text-primary">
                      {r.sourceFileName ?? r.title ?? formatPeriod(r.period)}
                    </Link>
                    <p className="truncate text-xs text-text-3">
                      {REPORT_TYPE_LABEL[r.type]} · {formatPeriod(r.period)} · {r.sourceType ? SOURCE_TYPE_LABEL[r.sourceType] : ""} · {formatDateTime(r.createdAt, tz)}
                    </p>
                  </div>
                  <ReportStatusBadge status={r.status} />
                  <a href={`/api/adm/clientes/${id}/relatorios/${r.id}/arquivo?download=1`} className={buttonClass("ghost", "icon")} aria-label={`Baixar ${r.sourceFileName ?? "arquivo"}`}>
                    <Download className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<FolderOpen />} title="Nenhum arquivo original" description="Relatórios de demonstração não têm arquivo original." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
