import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { env } from "@/lib/env";
import { buttonClass } from "@/components/ui/button";
import { getClientOverview, today } from "@/features/clients/service";
import { REPORT_TYPE_LABEL, type ReportType } from "@/features/reports/schema";
import { uploadHref } from "@/features/admin/overview";
import { ModuleStatusCard } from "./module-status-card";
import { ReportList } from "./report-list";

/** Aba Comercial/Tráfego do cliente: status da entrega + todos os relatórios do tipo. */
export async function ModuleReports({ clientId, type }: { clientId: string; type: ReportType }) {
  const o = await getClientOverview(clientId);
  if (!o) notFound();
  const entries = o.index.reports.filter((r) => r.type === type);
  const active = entries.filter((r) => r.status !== "archived" && r.status !== "superseded");
  const history = entries.filter((r) => r.status === "archived" || r.status === "superseded");
  const upload = (
    <Link href={uploadHref(clientId, type, o.delivery[type])} className={buttonClass("primary", "sm")}>
      <UploadCloud className="size-4" aria-hidden /> Enviar relatório
    </Link>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <ModuleStatusCard clientId={clientId} type={type} module={o.client.modules[type]} delivery={o.delivery[type]} today={today()} />
      </div>
      <div className="space-y-4 xl:col-span-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-text">Relatórios de {REPORT_TYPE_LABEL[type].toLowerCase()}</h2>
          {upload}
        </div>
        <ReportList clientId={clientId} entries={active} timeZone={env().APP_TIMEZONE} emptyAction={upload} />
        {history.length ? (
          <details className="group">
            <summary className="flex h-10 items-center text-sm font-semibold text-text-3 hover:text-text">
              Versões substituídas e arquivadas ({history.length})
            </summary>
            <div className="mt-2">
              <ReportList clientId={clientId} entries={history} timeZone={env().APP_TIMEZONE} />
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
