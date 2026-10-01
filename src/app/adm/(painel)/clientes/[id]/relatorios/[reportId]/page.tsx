import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, TriangleAlert } from "lucide-react";
import { env } from "@/lib/env";
import { formatDateTime, formatPeriod } from "@/lib/dates/period";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ReportStatusBadge } from "@/components/dashboard/status-badge";
import { ReportViewer } from "@/components/dashboard/report-viewer";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportStatusActions } from "@/features/admin/components/report-status-actions";
import { ReportDetailsEditor } from "@/features/admin/components/report-details-editor";
import { ReportPeriodDialog } from "@/features/admin/components/report-period-dialog";
import { getClient, today } from "@/features/clients/service";
import { periodOptions } from "@/features/uploads/period-options";
import { loadPortalModel } from "@/features/portal/model";
import { CommercialDashboard } from "@/features/commercial/components/commercial-dashboard";
import { buildCommercialViewModel } from "@/features/commercial/view-model";
import { TrafficDashboard } from "@/features/traffic/components/traffic-dashboard";
import { buildTrafficViewModel } from "@/features/traffic/view-model";
import { getReportManifest } from "@/features/reports/service";
import { REPORT_TYPE_LABEL, SOURCE_TYPE_LABEL } from "@/features/reports/schema";

export const metadata: Metadata = { title: "Relatório" };

export default async function AdminReportPage(props: PageProps<"/adm/clientes/[id]/relatorios/[reportId]">) {
  const { id, reportId } = await props.params;
  const [client, manifest] = await Promise.all([getClient(id), getReportManifest(id, reportId)]);
  if (!client || !manifest || manifest.clientId !== id) notFound();
  const tz = env().APP_TIMEZONE;
  const label = `${REPORT_TYPE_LABEL[manifest.type]} · ${formatPeriod(manifest.period)}`;
  const tabPath = manifest.type === "commercial" ? "comercial" : "trafego";
  const fileUrl = `/api/adm/clientes/${id}/relatorios/${reportId}/arquivo`;
  const model = await loadPortalModel(client, { mode: "preview", focusReportId: reportId });
  const dataset = model.selection.dataset?.entry.id === reportId ? model.selection.dataset : null;
  const hasOriginal = Boolean(manifest.source?.path);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/adm/clientes/${id}/${tabPath}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-3 hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> Relatórios de {REPORT_TYPE_LABEL[manifest.type].toLowerCase()}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-text">{manifest.title ?? label}</h2>
              <ReportStatusBadge status={manifest.status} />
            </div>
            <p className="mt-1 text-sm text-text-3">
              {manifest.title ? `${label} · ` : ""}
              {manifest.kind === "dataset" ? "Dashboard" : "Documento"}
              {manifest.source ? ` · ${SOURCE_TYPE_LABEL[manifest.source.type]}${manifest.source.type !== "seed" ? ` (${manifest.source.fileName})` : ""}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-text-3">
              Criado em {formatDateTime(manifest.createdAt, tz)}
              {manifest.publishedAt ? ` · publicado em ${formatDateTime(manifest.publishedAt, tz)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasOriginal ? (
              <a href={`${fileUrl}?download=1`} className={buttonClass("ghost")}>
                <Download className="size-4" aria-hidden /> Original
              </a>
            ) : null}
            {manifest.status !== "archived" ? (
              <ReportPeriodDialog
                clientId={id}
                reportId={reportId}
                current={{ key: manifest.periodKey, label: formatPeriod(manifest.period) }}
                options={periodOptions(client.modules[manifest.type].cadence, today())}
                published={manifest.status === "published"}
              />
            ) : null}
            <ReportStatusActions clientId={id} reportId={reportId} status={manifest.status} label={label} />
          </div>
        </div>
      </div>

      {manifest.warnings.length ? (
        <Card>
          <CardHeader title={`Avisos da importação (${manifest.warnings.length})`} subtitle="Não impediram a importação, mas vale conferir antes de publicar." icon={<TriangleAlert className="size-4 text-attention" />} />
          <CardBody>
            <ul className="space-y-2">
              {manifest.warnings.map((w, i) => (
                <li key={i} className="rounded-xl bg-attention-soft px-3.5 py-2.5 text-sm text-text-2">
                  {w.message}
                  {w.location?.sheet ? <span className="text-text-3"> · aba {w.location.sheet}{w.location.row ? `, linha ${w.location.row}` : ""}</span> : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-12">
        <section className="min-w-0 2xl:col-span-8" aria-labelledby="preview-title">
          <div className="mb-3 flex items-center justify-between">
            <h3 id="preview-title" className="text-base font-bold text-text">
              Prévia — como o cliente verá
            </h3>
            {manifest.status !== "published" ? <span className="text-xs font-semibold text-attention">Ainda não visível para o cliente</span> : null}
          </div>
          <div className="rounded-[var(--radius-xl)] border border-dashed border-border-strong p-3 sm:p-5">
            {dataset ? (
              dataset.data.type === "commercial" ? (
                <CommercialDashboard vm={buildCommercialViewModel(dataset.data.data, { previous: model.previous, history: model.history, dashboard: client.dashboard })} insights={manifest.insights} currency={client.currency} />
              ) : (
                <TrafficDashboard vm={buildTrafficViewModel(dataset.data.data, { previous: model.previous, history: model.history })} insights={manifest.insights} currency={client.currency} />
              )
            ) : manifest.kind === "document" && manifest.source ? (
              <ReportViewer source={manifest.source.type} src={fileUrl} downloadHref={`${fileUrl}?download=1`} title={manifest.title ?? label} />
            ) : (
              <EmptyState title="Prévia indisponível" description="Os dados deste relatório não puderam ser lidos. Reenvie o arquivo." />
            )}
          </div>
        </section>
        <Card className="h-fit 2xl:col-span-4">
          <CardHeader title="Detalhes e insights" subtitle="Edite antes ou depois de publicar." />
          <CardBody>
            <ReportDetailsEditor clientId={id} reportId={reportId} title={manifest.title} allowDownload={manifest.allowDownload} insights={manifest.insights} hasOriginal={hasOriginal} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
