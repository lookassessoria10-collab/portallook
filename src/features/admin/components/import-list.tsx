import Link from "next/link";
import { formatDateTime } from "@/lib/dates/period";
import { ImportStatusBadge } from "@/components/dashboard/status-badge";
import { REPORT_TYPE_LABEL, type ImportIndexEntry } from "@/features/reports/schema";
import { DeleteImportButton } from "./delete-import-button";

/** Uploads recebidos (inclusive com erro) — o registro completo abre no assistente. */
export function ImportList({ imports, timeZone, showClient }: { imports: Array<ImportIndexEntry & { clientId: string; clientName?: string }>; timeZone: string; showClient?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {imports.map((i) => (
        <li key={i.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <Link href={`/adm/uploads/${i.id}`} className="block truncate text-sm font-bold text-text hover:text-primary">
              {i.fileName}
            </Link>
            <p className="truncate text-xs text-text-3">
              {showClient && i.clientName ? `${i.clientName} · ` : ""}
              {REPORT_TYPE_LABEL[i.reportType]} · {i.format === "md" ? "Dados colados" : i.format.toUpperCase()} · {formatDateTime(i.createdAt, timeZone)}
              {i.errorCount ? ` · ${i.errorCount} erro(s)` : ""}
              {i.warningCount ? ` · ${i.warningCount} aviso(s)` : ""}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <ImportStatusBadge status={i.status} />
            <DeleteImportButton clientId={i.clientId} importId={i.id} fileName={i.fileName} imported={i.status === "imported"} />
          </div>
        </li>
      ))}
    </ul>
  );
}
