import Link from "next/link";
import { notFound } from "next/navigation";
import { History, UploadCloud } from "lucide-react";
import { env } from "@/lib/env";
import { formatPeriod } from "@/lib/dates/period";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getClientOverview, today } from "@/features/clients/service";
import { REPORT_TYPE_LABEL, type ReportIndexEntry, type ReportType } from "@/features/reports/schema";
import { retroactiveUploadHref, uploadHref } from "@/features/admin/overview";
import { ModuleStatusCard } from "./module-status-card";
import { ReportList } from "./report-list";

/** Aba Comercial/Tráfego/Plano de mídia do cliente: status da entrega + todos os relatórios do tipo. */
export async function ModuleReports({ clientId, type }: { clientId: string; type: ReportType }) {
  const o = await getClientOverview(clientId);
  if (!o) notFound();
  const entries = o.index.reports.filter((r) => r.type === type);
  const active = entries.filter((r) => r.status !== "archived" && r.status !== "superseded");
  const history = entries.filter((r) => r.status === "archived" || r.status === "superseded");
  const upload = (
    <Link href={uploadHref(clientId, type, o.delivery[type])} className={buttonClass("primary", "sm")}>
      <UploadCloud className="size-4" aria-hidden /> {type === "media_plan" ? "Enviar plano" : "Enviar relatório"}
    </Link>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-4">
        <ModuleStatusCard clientId={clientId} type={type} module={o.client.modules[type]} delivery={o.delivery[type]} today={today()} />
        {type === "traffic" ? <RetroactiveCard clientId={clientId} entries={active} weekly={o.client.modules.traffic.cadence === "weekly"} /> : null}
      </div>
      <div className="space-y-4 xl:col-span-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-text">{type === "media_plan" ? "Planos de mídia" : `Relatórios de ${REPORT_TYPE_LABEL[type].toLowerCase()}`}</h2>
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

/** Tráfego: envio dos meses anteriores (retroativo), para o cliente comparar mês a mês. */
function RetroactiveCard({ clientId, entries, weekly }: { clientId: string; entries: ReportIndexEntry[]; weekly: boolean }) {
  const months = entries.filter((e) => e.kind === "dataset" && e.period.granularity === "month").sort((a, b) => (a.period.start < b.period.start ? -1 : 1));
  const retro = months.filter((e) => e.retroactive);
  return (
    <Card>
      <CardHeader title="Meses anteriores" subtitle="Dados retroativos para comparação" icon={<History className="size-4" />} />
      <CardBody className="space-y-3">
        <p className="text-[13px] leading-relaxed text-text-2">
          Suba de uma vez os meses anteriores de tráfego. Só entram os meses que ainda não estão no portal; os que já existem não são alterados. O cliente vê tudo na mesma aba de Tráfego{weekly ? ", na escala “Meses”" : ""}.
        </p>
        <p className="text-xs text-text-3">
          {months.length
            ? `Meses no sistema: ${formatPeriod(months[0].period, "short")} a ${formatPeriod(months[months.length - 1].period, "short")} (${months.length})${retro.length ? ` · ${retro.length} enviado(s) como retroativo` : ""}.`
            : "Nenhum mês de tráfego no sistema ainda."}
        </p>
        <Link href={retroactiveUploadHref(clientId)} className={buttonClass("secondary", "sm")}>
          <UploadCloud className="size-4" aria-hidden /> Subir meses anteriores
        </Link>
      </CardBody>
    </Card>
  );
}
