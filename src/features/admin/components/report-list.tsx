import Link from "next/link";
import { FileCode, FileSpreadsheet, FileText, FolderOpen, Database } from "lucide-react";
import { formatDateTime, formatPeriod } from "@/lib/dates/period";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportStatusBadge } from "@/components/dashboard/status-badge";
import { SOURCE_TYPE_LABEL, REPORT_TYPE_LABEL, type ReportIndexEntry } from "@/features/reports/schema";
import { ReportQuickAction } from "./report-row-actions";

function SourceIcon({ entry }: { entry: ReportIndexEntry }) {
  if (entry.sourceType === "pdf") return <FileText aria-hidden />;
  if (entry.sourceType === "html_legacy") return <FileCode aria-hidden />;
  if (entry.sourceType === "seed") return <Database aria-hidden />;
  return <FileSpreadsheet aria-hidden />;
}

export function describeEntry(entry: ReportIndexEntry): string {
  const kind = entry.kind === "dataset" ? "Dashboard" : "Documento";
  const source = entry.sourceType ? SOURCE_TYPE_LABEL[entry.sourceType] : "—";
  return `${kind} · ${source}`;
}

export function ReportList({ clientId, entries, timeZone, emptyAction }: { clientId: string; entries: ReportIndexEntry[]; timeZone: string; emptyAction?: React.ReactNode }) {
  if (!entries.length) {
    return (
      <div className="card">
        <EmptyState icon={<FolderOpen />} title="Nenhum relatório ainda" description="Envie um arquivo para criar o primeiro rascunho." action={emptyAction} />
      </div>
    );
  }
  return (
    <ul className="card divide-y divide-border">
      {entries.map((e) => {
        const label = `${REPORT_TYPE_LABEL[e.type]} · ${formatPeriod(e.period)}`;
        return (
          <li key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <Link href={`/adm/clientes/${clientId}/relatorios/${e.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2 [&>svg]:size-[18px]">
                <SourceIcon entry={e} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold text-text group-hover:text-primary">{e.title ?? formatPeriod(e.period)}</span>
                <span className="block truncate text-xs text-text-3">
                  {e.title ? `${formatPeriod(e.period)} · ` : ""}
                  {describeEntry(e)}
                  {e.sourceFileName && e.sourceType !== "seed" ? ` · ${e.sourceFileName}` : ""} · atualizado {formatDateTime(e.updatedAt, timeZone)}
                </span>
              </span>
            </Link>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <ReportStatusBadge status={e.status} />
              <ReportQuickAction clientId={clientId} reportId={e.id} status={e.status} label={label} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
