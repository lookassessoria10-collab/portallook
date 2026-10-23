import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSpreadsheet, ListChecks } from "lucide-react";
import { formatDate } from "@/lib/dates/period";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/features/admin/components/admin-shell";
import { listActionsOverview } from "@/features/actions/service";
import { ACTION_KIND_LABEL, ACTION_STATUS_LABEL, ACTION_STATUS_TONE, type ActionStatus } from "@/features/actions/schema";
import { sortActions, summarizeActions } from "@/features/actions/view-model";

export const metadata: Metadata = { title: "Ações" };

/** Filtros da lista: "Em foco" segue a planilha (em andamento, com pendência ou sem status). */
const FILTERS: Array<{ key: string; label: string; statuses: ActionStatus[] | null }> = [
  { key: "foco", label: "Em foco", statuses: ["in_progress", "pending", "suggested"] },
  { key: "andamento", label: "Em andamento", statuses: ["in_progress"] },
  { key: "pendencia", label: "Pendência", statuses: ["pending"] },
  { key: "sem-status", label: "Sem status", statuses: ["suggested"] },
  { key: "aprovada", label: "Aprovadas", statuses: ["approved"] },
  { key: "concluida", label: "Concluídas", statuses: ["done"] },
  { key: "nao-aprovada", label: "Não aprovadas", statuses: ["rejected"] },
  { key: "todas", label: "Todas", statuses: null },
];

export default async function ActionsOverviewPage(props: PageProps<"/adm/acoes">) {
  const search = await props.searchParams;
  const filter = FILTERS.find((f) => f.key === search.status) ?? FILTERS[0];
  const { rows, unmatchedSheets } = await listActionsOverview();
  const all = rows.flatMap((r) => r.actions.items);
  const total = summarizeActions(all);
  const perClient = rows.map((r) => ({ ...r, summary: summarizeActions(r.actions.items) })).filter((r) => r.summary.total > 0 || r.actions.origin === "stored");
  const withoutActions = rows.filter((r) => r.actions.items.length === 0 && r.actions.origin !== "stored");
  const focus = sortActions(rows.flatMap((r) => r.actions.items.map((a) => ({ client: r.client, action: a, executedAt: a.executedAt, suggestedAt: a.suggestedAt })))).filter(
    ({ action }) => !filter.statuses || filter.statuses.includes(action.status),
  );

  return (
    <>
      <PageHeader title="Ações" description="Painel de ações de todos os clientes, com os mesmos indicadores da planilha de ações da Look." />

      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Total de ações", total.total, ""],
          ["Em andamento", total.byStatus.in_progress, "text-primary"],
          ["Executadas", total.executed, ""],
          ["Concluídas", total.byStatus.done, "text-positive"],
          ["Sem status", total.byStatus.suggested, "text-text-2"],
        ].map(([label, value, tone]) => (
          <div key={label} className="card px-4 py-3.5">
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-3">{label}</p>
            <p className={cn("tabular mt-1 text-2xl font-bold text-text", tone)}>{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Por cliente" subtitle="Clientes do portal com ações. Quem não está na planilha fica de fora até ganhar ações no painel." icon={<ListChecks className="size-4" />} />
          <CardBody className="px-0 sm:px-0">
            {perClient.length ? (
              <div className="overflow-x-auto">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">Origem</th>
                      <th scope="col" className="text-right">Total</th>
                      <th scope="col" className="text-right">Andamento</th>
                      <th scope="col" className="text-right">Executadas</th>
                      <th scope="col" className="text-right">Concluídas</th>
                      <th scope="col" className="text-right">Sem status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perClient.map(({ client, actions, summary }) => (
                      <tr key={client.id}>
                        <th scope="row" className="text-left">
                          <Link href={`/adm/clientes/${client.id}/acoes`} className="font-bold text-text hover:text-primary">
                            {client.name}
                          </Link>
                          {!actions.enabled ? <span className="ml-2 text-[11px] font-semibold text-attention">oculta no portal</span> : null}
                        </th>
                        <td className="whitespace-nowrap text-text-3">{actions.origin === "sheet" ? `Planilha · ${actions.sheet}` : "Painel"}</td>
                        <td className="tabular text-right font-bold text-text">{summary.total}</td>
                        <td className="tabular text-right">{summary.byStatus.in_progress}</td>
                        <td className="tabular text-right">{summary.executed}</td>
                        <td className="tabular text-right">{summary.byStatus.done}</td>
                        <td className="tabular text-right">{summary.byStatus.suggested}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState compact title="Nenhum cliente com ações" />
            )}
          </CardBody>
        </Card>

        <div className="space-y-6 xl:col-span-5">
          <Card>
            <CardHeader title="Planilha de ações" icon={<FileSpreadsheet className="size-4" />} />
            <CardBody className="space-y-4 text-[13px] leading-relaxed text-text-2">
              {withoutActions.length ? (
                <div>
                  <p className="font-semibold text-text">Clientes do portal sem aba na planilha ({withoutActions.length})</p>
                  <p className="mt-0.5 text-text-3">Ficam sem a área Ações até alguém cadastrar ou importar ações para eles.</p>
                  <p className="mt-1.5">
                    {withoutActions.map((r, i) => (
                      <span key={r.client.id}>
                        {i ? " · " : ""}
                        <Link href={`/adm/clientes/${r.client.id}/acoes`} className="font-semibold hover:text-primary">
                          {r.client.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                </div>
              ) : null}
              {unmatchedSheets.length ? (
                <div>
                  <p className="font-semibold text-text">Abas sem cliente no portal ({unmatchedSheets.length})</p>
                  <p className="mt-0.5 text-text-3">Foram ignoradas. Para usar uma delas, abra o cliente e escolha “Importar da planilha”.</p>
                  <p className="mt-1.5">{unmatchedSheets.join(" · ")}</p>
                </div>
              ) : (
                <p className="text-text-3">Todas as abas da planilha estão ligadas a um cliente do portal.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="xl:col-span-12">
          <CardHeader title="Ações" subtitle="Da mais recente para a mais antiga. “Em foco” reúne as ações em andamento, com pendência ou sem status." />
          <CardBody>
            <nav aria-label="Filtrar por status" className="scrollbar-none -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {FILTERS.map((f) => {
                const count = f.statuses ? all.filter((a) => f.statuses!.includes(a.status)).length : all.length;
                return (
                  <Link
                    key={f.key}
                    href={f.key === "foco" ? "/adm/acoes" : `/adm/acoes?status=${f.key}`}
                    aria-current={filter.key === f.key ? "page" : undefined}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold",
                      filter.key === f.key ? "border-transparent bg-primary text-on-primary" : "border-border-strong text-text-2 hover:bg-surface-2",
                    )}
                  >
                    {f.label}
                    <span className="tabular text-[11px] font-bold opacity-75">{count}</span>
                  </Link>
                );
              })}
            </nav>
            {focus.length ? (
              <ul className="divide-y divide-border">
                {focus.map(({ client, action: a }) => (
                  <li key={`${client.id}-${a.id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/adm/clientes/${client.id}/acoes`} className="text-[13px] font-bold text-primary hover:underline">
                          {client.name}
                        </Link>
                        {a.category ? <span className="text-xs text-text-3">{a.category}</span> : null}
                        {a.kind ? <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-3">{ACTION_KIND_LABEL[a.kind]}</span> : null}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold leading-snug text-text">{a.title}</p>
                      {a.notes ? <p className="mt-0.5 text-[13px] text-text-3">{a.notes}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="tabular text-xs text-text-3">{a.suggestedAt ? `Sugerida em ${formatDate(a.suggestedAt)}` : "Sem data"}</span>
                      <Badge tone={ACTION_STATUS_TONE[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Badge>
                      <Link href={`/adm/clientes/${client.id}/acoes`} className="text-text-3 hover:text-text" aria-label={`Abrir ações de ${client.name}`}>
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Nenhuma ação com esse filtro" />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
