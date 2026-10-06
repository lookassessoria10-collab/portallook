import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { formatDate, formatPeriod, formatRelativeDays } from "@/lib/dates/period";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DeliveryBadge } from "@/components/dashboard/status-badge";
import { PageHeader } from "@/features/admin/components/admin-shell";
import { buildAdminOverview, uploadHref } from "@/features/admin/overview";
import { listClientOverviews, today } from "@/features/clients/service";
import { REPORT_TYPE_LABEL, reportTypeFromParam } from "@/features/reports/schema";

export const metadata: Metadata = { title: "Pendências" };

const TYPE_FILTERS = [
  { key: "", label: "Todos" },
  { key: "commercial", label: "Comercial" },
  { key: "traffic", label: "Tráfego" },
  { key: "media_plan", label: "Plano de mídia" },
];

export default async function PendingPage(props: PageProps<"/adm/pendencias">) {
  const search = await props.searchParams;
  const type = reportTypeFromParam(typeof search.tipo === "string" ? search.tipo : null) ?? "";
  const o = buildAdminOverview(await listClientOverviews());
  const date = today();
  const items = o.attention.filter((a) => !type || a.type === type);

  return (
    <>
      <PageHeader title="Pendências" description="Relatórios cujo prazo passou, com erro de importação ou aguardando publicação." />
      <nav aria-label="Filtrar por tipo" className="mb-4 flex gap-1.5">
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/adm/pendencias?tipo=${f.key}` : "/adm/pendencias"}
            aria-current={type === f.key ? "page" : undefined}
            className={cn("flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold", type === f.key ? "border-transparent bg-primary text-on-primary" : "border-border-strong text-text-2 hover:bg-surface-2")}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {items.length ? (
        <ul className="card divide-y divide-border">
          {items.map((item) => {
            const d = item.delivery;
            const href = item.state === "draft" && d.expectedReport ? `/adm/clientes/${item.clientId}/relatorios/${d.expectedReport.id}` : uploadHref(item.clientId, item.type, d);
            return (
              <li key={`${item.clientId}-${item.type}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/adm/clientes/${item.clientId}`} className="font-bold text-text hover:text-primary">
                      {item.clientName}
                    </Link>
                    <span className="text-xs font-semibold text-text-3">{REPORT_TYPE_LABEL[item.type]}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-text-3">
                    Esperado: {d.expectedPeriod ? formatPeriod(d.expectedPeriod) : "—"} · prazo {formatDate(d.expectedDueDate)}
                    {d.expectedDueDate ? ` (${formatRelativeDays(d.expectedDueDate, date)})` : ""}
                    {d.latestPublished ? ` · último publicado: ${formatPeriod(d.latestPublished.period, "short")}` : " · nenhum publicado ainda"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DeliveryBadge state={item.state} />
                  <Link href={href} className={buttonClass(item.state === "draft" ? "subtle" : "primary", "sm")}>
                    {item.state === "draft" ? "Revisar e publicar" : item.state === "error" ? "Reenviar arquivo" : "Enviar relatório"}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card">
          <EmptyState icon={<CircleCheck />} title="Nenhuma pendência" description="Todos os relatórios esperados até hoje foram publicados." />
        </div>
      )}
    </>
  );
}
