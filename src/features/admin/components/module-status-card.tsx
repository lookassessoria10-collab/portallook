import Link from "next/link";
import { ArrowRight, UploadCloud } from "lucide-react";
import { formatDate, formatPeriod, formatRelativeDays, WEEKDAYS_PT } from "@/lib/dates/period";
import { buttonClass } from "@/components/ui/button";
import { DeliveryBadge } from "@/components/dashboard/status-badge";
import { uploadHref } from "@/features/admin/overview";
import type { ModuleConfig } from "@/features/clients/schema";
import type { DeliveryStatus } from "@/features/reports/delivery";
import { REPORT_TYPE_LABEL, REPORT_TYPE_PATH, type ReportType } from "@/features/reports/schema";

export function cadenceLabel(m: ModuleConfig, type?: ReportType): string {
  if (m.cadence === "weekly") return `Semanal · entrega até ${WEEKDAYS_PT[m.dueDay - 1]}`;
  if (type === "media_plan") return `Mensal · entrega até o dia ${m.dueDay} do próprio mês`;
  return `Mensal · entrega até o dia ${m.dueDay}`;
}

export function ModuleStatusCard({ clientId, type, module, delivery, today }: { clientId: string; type: ReportType; module: ModuleConfig; delivery: DeliveryStatus; today: string }) {
  if (!module.enabled) {
    return (
      <section className="card p-5" aria-label={REPORT_TYPE_LABEL[type]}>
        <h3 className="text-base font-bold text-text">{REPORT_TYPE_LABEL[type]}</h3>
        <p className="mt-1 text-sm text-text-3">Módulo não contratado. Ative em Configurações.</p>
      </section>
    );
  }
  const d = delivery;
  const rows: Array<[string, string]> = [
    ["Periodicidade", cadenceLabel(module, type)],
    ["Último publicado", d.latestPublished ? formatPeriod(d.latestPublished.period) : "Nenhum"],
    [
      d.state === "updated" || d.state === "upcoming" ? (type === "media_plan" ? "Próximo plano" : "Próximo relatório") : type === "media_plan" ? "Plano esperado" : "Relatório esperado",
      d.state === "updated" || d.state === "upcoming"
        ? d.nextPeriod
          ? `${formatPeriod(d.nextPeriod)} · até ${formatDate(d.nextDueDate)}`
          : "—"
        : d.expectedPeriod
          ? `${formatPeriod(d.expectedPeriod)} · prazo ${formatDate(d.expectedDueDate)}${d.state === "pending" && d.expectedDueDate ? ` (${formatRelativeDays(d.expectedDueDate, today)})` : ""}`
          : "—",
    ],
  ];
  return (
    <section className="card flex flex-col p-5" aria-label={REPORT_TYPE_LABEL[type]}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-text">{REPORT_TYPE_LABEL[type]}</h3>
        <DeliveryBadge state={d.state} />
      </div>
      <dl className="mt-4 space-y-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-[13px] text-text-3">{k}</dt>
            <dd className="text-sm font-semibold text-text sm:text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        {d.state === "draft" && d.expectedReport ? (
          <Link href={`/adm/clientes/${clientId}/relatorios/${d.expectedReport.id}`} className={buttonClass("primary", "sm")}>
            Revisar e publicar <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
        <Link href={uploadHref(clientId, type, d.state === "updated" || d.state === "upcoming" ? null : d)} className={buttonClass(d.state === "pending" || d.state === "error" ? "primary" : "secondary", "sm")}>
          <UploadCloud className="size-4" aria-hidden /> {type === "media_plan" ? "Enviar plano" : "Enviar relatório"}
        </Link>
        <Link href={`/adm/clientes/${clientId}/${REPORT_TYPE_PATH[type]}`} className={buttonClass("ghost", "sm")}>
          {type === "media_plan" ? "Ver planos" : "Ver relatórios"}
        </Link>
      </div>
    </section>
  );
}
