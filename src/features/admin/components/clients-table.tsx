"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Search, Settings, UploadCloud, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTimestampDate } from "@/lib/dates/period";
import { normalizeText } from "@/lib/ids";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionMenu } from "@/components/ui/menu";
import { buttonClass } from "@/components/ui/button";
import { ClientAvatar } from "@/components/brand/client-avatar";
import { DeliveryBadge } from "@/components/dashboard/status-badge";
import type { ClientRow, ModuleCell } from "@/features/admin/client-rows";

type Filter = "all" | "updated" | "pending" | "draft" | "error" | "inactive";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "updated", label: "Atualizados" },
  { key: "pending", label: "Pendentes" },
  { key: "draft", label: "Rascunho" },
  { key: "error", label: "Com erro" },
  { key: "inactive", label: "Inativos" },
];

function matches(row: ClientRow, filter: Filter): boolean {
  const states = (["commercial", "traffic"] as const).filter((t) => row.modules[t].enabled).map((t) => row.modules[t].state);
  switch (filter) {
    case "all":
      return row.status !== "archived";
    case "inactive":
      return row.status !== "active";
    case "updated":
      return row.status === "active" && states.length > 0 && states.every((s) => s === "updated" || s === "upcoming");
    default:
      return row.status === "active" && states.includes(filter);
  }
}

export function ClientsTable({ rows, timeZone }: { rows: ClientRow[]; timeZone: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(r, f.key)).length])) as Record<Filter, number>, [rows]);
  const visible = useMemo(() => {
    const q = normalizeText(query);
    return rows.filter((r) => matches(r, filter) && (!q || normalizeText(`${r.name} ${r.slug} ${r.segment}`).includes(q)));
  }, [rows, filter, query]);

  const copy = async (url: string | null) => {
    if (!url) return toast.error("Este cliente não tem link ativo.");
    await navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="radiogroup" aria-label="Filtrar clientes" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                filter === f.key ? "border-transparent bg-primary text-on-primary" : "border-border-strong text-text-2 hover:bg-surface-2 hover:text-text",
              )}
            >
              {f.label}
              <span className={cn("tabular text-xs", filter === f.key ? "text-on-primary/80" : "text-text-3")}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <label className="relative block md:w-72">
          <span className="sr-only">Buscar cliente</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente"
            className="h-10 w-full rounded-[10px] border border-border-strong bg-bg-elevated pl-9 pr-3 text-sm text-text placeholder:text-text-3 focus:border-border-focus focus:outline-none"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="card mt-4">
          <EmptyState
            icon={<Users />}
            title={rows.length ? "Nenhum cliente neste filtro" : "Nenhum cliente cadastrado"}
            description={rows.length ? "Ajuste o filtro ou a busca." : "Cadastre o primeiro cliente para começar."}
            action={
              rows.length ? null : (
                <Link href="/adm/clientes/novo" className={buttonClass("primary")}>
                  <UserPlus className="size-4" aria-hidden /> Novo cliente
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="card mt-4 hidden overflow-x-auto xl:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Clientes e status das entregas</caption>
              <thead className="bg-surface-2/60 text-left text-xs text-text-3">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Cliente</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Comercial</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Tráfego</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Última atualização</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Próxima entrega</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t border-border align-middle hover:bg-surface-2/40">
                    <th scope="row" className="px-5 py-3.5 text-left font-normal">
                      <Link href={`/adm/clientes/${r.id}`} className="group flex items-center gap-3">
                        <ClientAvatar name={r.name} size={36} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-text group-hover:text-primary">{r.name}</span>
                          <span className="block truncate text-xs text-text-3">
                            /{r.slug}
                            {r.status !== "active" ? " · inativo" : ""}
                          </span>
                        </span>
                      </Link>
                    </th>
                    <td className="px-3 py-3.5">
                      <ModuleStatus cell={r.modules.commercial} />
                    </td>
                    <td className="px-3 py-3.5">
                      <ModuleStatus cell={r.modules.traffic} />
                    </td>
                    <td className="tabular px-3 py-3.5 text-text-2">{r.lastUpdatedAt ? formatTimestampDate(r.lastUpdatedAt, timeZone) : "—"}</td>
                    <td className="tabular px-3 py-3.5 text-text-2">{r.nextDueDate ? formatDate(r.nextDueDate) : "—"}</td>
                    <td className="px-5 py-3.5">
                      <RowActions row={r} onCopy={() => copy(r.portalUrl)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet: cards */}
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:hidden">
            {visible.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <Link href={`/adm/clientes/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <ClientAvatar name={r.name} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-text">{r.name}</span>
                      <span className="block truncate text-xs text-text-3">
                        /{r.slug}
                        {r.status !== "active" ? " · inativo" : ""}
                      </span>
                    </span>
                  </Link>
                  <RowActions row={r} onCopy={() => copy(r.portalUrl)} compact />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="mb-1 text-xs font-semibold text-text-3">Comercial</dt>
                    <dd>
                      <ModuleStatus cell={r.modules.commercial} />
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs font-semibold text-text-3">Tráfego</dt>
                    <dd>
                      <ModuleStatus cell={r.modules.traffic} />
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 border-t border-border pt-3 text-xs text-text-3">
                  Atualizado {r.lastUpdatedAt ? `em ${formatTimestampDate(r.lastUpdatedAt, timeZone)}` : "—"} · Próxima entrega {r.nextDueDate ? formatDate(r.nextDueDate) : "—"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ModuleStatus({ cell }: { cell: ModuleCell }) {
  if (!cell.enabled) return <span className="text-xs text-text-3">Não contratado</span>;
  return (
    <span className="flex flex-col items-start gap-1">
      <DeliveryBadge state={cell.state} />
      {cell.periodLabel ? (
        <span className="text-xs text-text-3">
          {cell.periodLabel}
          {cell.state === "pending" && cell.daysOverdue ? ` · ${cell.daysOverdue} dia(s) de atraso` : ""}
        </span>
      ) : null}
    </span>
  );
}

function RowActions({ row, onCopy, compact }: { row: ClientRow; onCopy: () => void; compact?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {!compact ? (
        <Link href={`/adm/uploads?cliente=${row.id}`} className={buttonClass("ghost", "sm")} title="Enviar relatório">
          <UploadCloud className="size-4" aria-hidden />
          <span className="sr-only xl:not-sr-only">Upload</span>
        </Link>
      ) : null}
      {row.openImportErrors ? <Badge tone="negative">{row.openImportErrors} erro(s)</Badge> : null}
      <ActionMenu
        label={`Ações para ${row.name}`}
        items={[
          { label: "Abrir cliente", href: `/adm/clientes/${row.id}`, icon: <Settings /> },
          ...(row.portalUrl ? [{ label: "Ver portal", href: row.portalUrl, external: true, icon: <ExternalLink /> }] : []),
          { label: "Copiar link", onSelect: onCopy, icon: <Copy /> },
          { label: "Enviar relatório", href: `/adm/uploads?cliente=${row.id}`, icon: <UploadCloud /> },
        ]}
      />
    </div>
  );
}
