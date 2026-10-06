import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, FileWarning, UploadCloud, Users } from "lucide-react";
import { env } from "@/lib/env";
import { formatDate, formatDateTime, formatPeriod, formatRelativeDays, MONTHS_PT, WEEKDAYS_PT, isoWeekday } from "@/lib/dates/period";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/button";
import { DeliveryBadge, ImportStatusBadge } from "@/components/dashboard/status-badge";
import { PageHeader } from "@/features/admin/components/admin-shell";
import { buildAdminOverview, uploadHref } from "@/features/admin/overview";
import { listClientOverviews, today } from "@/features/clients/service";
import { REPORT_TYPE_LABEL, type ReportType } from "@/features/reports/schema";
import type { ModuleCounts } from "@/features/admin/overview";

export const metadata: Metadata = { title: "Visão geral" };

function longToday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS_PT[isoWeekday(iso) - 1]}, ${d} de ${MONTHS_PT[m - 1]} de ${y}`;
}

export default async function AdminHome() {
  const overviews = await listClientOverviews();
  const o = buildAdminOverview(overviews);
  const date = today();
  const tz = env().APP_TIMEZONE;

  return (
    <>
      <PageHeader eyebrow={longToday(date)} title="Visão geral" description="Entregas, pendências e últimos envios de todos os clientes." />

      <section aria-label="Indicadores" className={o.modules.media_plan.total ? "grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5" : "grid grid-cols-2 gap-3 lg:grid-cols-4"}>
        <StatTile icon={<Users />} label="Clientes ativos" value={o.activeClients} hint={o.inactiveClients ? `${o.inactiveClients} inativo(s)` : "Todos ativos"} href="/adm/clientes" />
        <ModuleTile type="commercial" counts={o.modules.commercial} />
        <ModuleTile type="traffic" counts={o.modules.traffic} />
        {o.modules.media_plan.total ? <ModuleTile type="media_plan" counts={o.modules.media_plan} /> : null}
        <StatTile
          icon={<FileWarning />}
          label="Arquivos com erro"
          value={o.importErrors}
          hint={o.importErrors ? "Revise e envie novamente" : "Nenhum erro aberto"}
          tone={o.importErrors ? "negative" : "neutral"}
          href="/adm/uploads"
        />
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Precisa de atenção" subtitle="Relatórios pendentes, com erro ou aguardando publicação" actions={<Link href="/adm/pendencias" className="text-sm font-semibold text-primary hover:underline">Ver todas</Link>} />
          <CardBody>
            {o.attention.length ? (
              <ul className="divide-y divide-border">
                {o.attention.slice(0, 8).map((item) => {
                  const d = item.delivery;
                  const href = item.state === "draft" && d.expectedReport ? `/adm/clientes/${item.clientId}/relatorios/${d.expectedReport.id}` : uploadHref(item.clientId, item.type, d);
                  return (
                    <li key={`${item.clientId}-${item.type}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <Link href={`/adm/clientes/${item.clientId}`} className="truncate font-bold text-text hover:text-primary">
                            {item.clientName}
                          </Link>
                          <span className="text-xs font-semibold text-text-3">{REPORT_TYPE_LABEL[item.type]}</span>
                        </p>
                        <p className="mt-0.5 text-[13px] text-text-3">
                          {d.expectedPeriod ? formatPeriod(d.expectedPeriod) : "—"}
                          {d.expectedDueDate ? ` · prazo ${formatDate(d.expectedDueDate)}` : ""}
                          {item.state === "pending" && d.expectedDueDate ? ` (${formatRelativeDays(d.expectedDueDate, date)})` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DeliveryBadge state={item.state} />
                        <Link href={href} className={buttonClass(item.state === "draft" ? "subtle" : "secondary", "sm")}>
                          {item.state === "draft" ? "Revisar" : item.state === "error" ? "Reenviar" : "Enviar"}
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState compact icon={<CircleCheck />} title="Tudo em dia" description="Nenhum relatório pendente, com erro ou em rascunho." />
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader title="Últimos uploads" subtitle="Arquivos enviados ao sistema" actions={<Link href="/adm/uploads" className="text-sm font-semibold text-primary hover:underline">Enviar</Link>} />
          <CardBody>
            {o.recentImports.length ? (
              <ul className="divide-y divide-border">
                {o.recentImports.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text">{i.fileName}</span>
                      <span className="block truncate text-xs text-text-3">
                        {i.clientName} · {REPORT_TYPE_LABEL[i.reportType]} · {formatDateTime(i.createdAt, tz)}
                      </span>
                    </span>
                    <ImportStatusBadge status={i.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<UploadCloud />} title="Nenhum upload ainda" description="Os arquivos enviados aparecerão aqui." />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Publicados recentemente" subtitle="O que os clientes já estão vendo" />
        <CardBody>
          {o.recentPublished.length ? (
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {o.recentPublished.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-b border-border py-2.5">
                  <CircleCheck className="size-4 shrink-0 text-positive" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <Link href={`/adm/clientes/${r.clientId}/relatorios/${r.id}`} className="block truncate text-sm font-semibold text-text hover:text-primary">
                      {r.clientName} · {REPORT_TYPE_LABEL[r.type]}
                    </Link>
                    <span className="block truncate text-xs text-text-3">
                      {r.title ?? formatPeriod(r.period)} · publicado em {formatDateTime(r.publishedAt, tz)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CircleAlert />} title="Nada publicado ainda" />
          )}
        </CardBody>
      </Card>
    </>
  );
}

function StatTile({ icon, label, value, hint, href, tone = "neutral" }: { icon: React.ReactNode; label: string; value: number; hint: string; href: string; tone?: "neutral" | "negative" }) {
  return (
    <Link href={href} className="card group flex min-w-0 flex-col gap-2 p-4 transition-colors hover:border-border-strong sm:p-5">
      <span className="flex items-center gap-2 text-sm font-semibold text-text-2">
        <span className="text-text-3 [&>svg]:size-4" aria-hidden>
          {icon}
        </span>
        {label}
      </span>
      <span className={tone === "negative" && value > 0 ? "text-3xl font-bold text-negative" : "text-3xl font-bold text-text"}>{value}</span>
      <span className="text-xs text-text-3">{hint}</span>
    </Link>
  );
}

function ModuleTile({ type, counts }: { type: ReportType; counts: ModuleCounts }) {
  return (
    <Link href={`/adm/pendencias?tipo=${type}`} className="card flex min-w-0 flex-col gap-2 p-4 transition-colors hover:border-border-strong sm:p-5">
      <span className="text-sm font-semibold text-text-2">{REPORT_TYPE_LABEL[type]}</span>
      <dl className="grid grid-cols-3 gap-2">
        <Count label="Atualizados" value={counts.updated} tone="text-positive" />
        <Count label="Pendentes" value={counts.pending + counts.error} tone={counts.pending + counts.error ? "text-attention" : "text-text"} />
        <Count label="Rascunhos" value={counts.draft} tone={counts.draft ? "text-info" : "text-text"} />
      </dl>
      <span className="text-xs text-text-3">{counts.total} cliente(s) com o módulo</span>
    </Link>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="truncate text-[11px] font-semibold text-text-3">{label}</dt>
      <dd className={`text-2xl font-bold ${tone}`}>{value}</dd>
    </div>
  );
}
