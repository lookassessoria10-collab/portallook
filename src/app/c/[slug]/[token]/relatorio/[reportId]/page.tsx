import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatPeriod } from "@/lib/dates/period";
import { LookLogo } from "@/components/brand/look-logo";
import { ReportViewer } from "@/components/dashboard/report-viewer";
import { InsightList } from "@/components/dashboard/insight-list";
import { getPortalClient, getVisibleReport, portalBasePath } from "@/features/portal/access";
import { REPORT_TYPE_LABEL, REPORT_TYPE_PATH } from "@/features/reports/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/c/[slug]/[token]/relatorio/[reportId]">): Promise<Metadata> {
  const { slug, token, reportId } = await props.params;
  const client = await getPortalClient(slug, token);
  const report = client ? await getVisibleReport(client, reportId) : null;
  return { title: report ? (report.title ?? "Relatório original") : "Link indisponível", robots: { index: false, follow: false } };
}

export default async function ReportDocumentPage(props: PageProps<"/c/[slug]/[token]/relatorio/[reportId]">) {
  const { slug, token, reportId } = await props.params;
  const client = await getPortalClient(slug, token);
  if (!client) notFound();
  const report = await getVisibleReport(client, reportId);
  if (!report || !report.source) notFound();

  const base = portalBasePath(slug, token);
  const tab = REPORT_TYPE_PATH[report.type];
  const file = `${base}/arquivo/${report.id}`;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-12 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4 sm:py-6">
        <Link href={`${base}?aba=${tab}&periodo=${encodeURIComponent(report.periodKey)}`} className="inline-flex h-10 items-center gap-2 rounded-[10px] px-2 text-sm font-semibold text-text-2 hover:bg-surface-2 hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> Voltar ao dashboard
        </Link>
        <LookLogo wordmark width={68} />
      </header>
      <div className="mb-4">
        <p className="eyebrow">
          {REPORT_TYPE_LABEL[report.type]} · {formatPeriod(report.period)}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-text">{report.title ?? "Relatório original"}</h1>
      </div>
      <ReportViewer source={report.source.type} src={file} downloadHref={report.allowDownload ? `${file}?download=1` : null} title={report.title ?? "Relatório"} />
      {report.insights.length ? (
        <section className="mt-8" aria-label="Insights">
          <h2 className="mb-3 text-lg font-bold text-text">Insights da Look</h2>
          <InsightList insights={report.insights} />
        </section>
      ) : null}
    </div>
  );
}
