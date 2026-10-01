import Link from "next/link";
import { ChevronRight, Download, FileCode, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SOURCE_TYPE_LABEL, type ReportIndexEntry, type SourceType } from "@/features/reports/schema";

export interface PortalLinks {
  /** Visão geral (todos os períodos) da área atual. */
  overview: string;
  period: (key: string) => string;
  document: (reportId: string) => string;
  file: (reportId: string, download?: boolean) => string;
}

function DocIcon({ type }: { type: SourceType | null }) {
  if (type === "pdf") return <FileText aria-hidden />;
  if (type === "html_legacy" || type === "html_structured") return <FileCode aria-hidden />;
  return <FileSpreadsheet aria-hidden />;
}

/** "Relatórios originais" do período: PDF, HTML ou a planilha que gerou o dashboard. */
export function OriginalDocuments({ documents, dataset, links }: { documents: ReportIndexEntry[]; dataset: ReportIndexEntry | null; links: PortalLinks }) {
  const spreadsheet = dataset && dataset.allowDownload && dataset.sourceType && ["xlsx", "xls", "csv", "md", "html_structured"].includes(dataset.sourceType) ? dataset : null;
  if (!documents.length && !spreadsheet) return null;
  return (
    <Card>
      <CardHeader title="Relatórios originais" subtitle="Arquivos enviados pela Look para este período" />
      <CardBody>
        <ul className="divide-y divide-border">
          {documents.map((d) => (
            <li key={d.id}>
              <Link href={links.document(d.id)} className="group flex items-center gap-3 py-3 first:pt-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2 [&>svg]:size-[18px]">
                  <DocIcon type={d.sourceType} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-text group-hover:text-primary">{d.title ?? "Relatório do período"}</span>
                  <span className="block text-xs text-text-3">{d.sourceType ? SOURCE_TYPE_LABEL[d.sourceType] : "Documento"} · Ver relatório original</span>
                </span>
                <ChevronRight className="size-4 text-text-3" aria-hidden />
              </Link>
            </li>
          ))}
          {spreadsheet ? (
            <li>
              <a href={links.file(spreadsheet.id, true)} className="group flex items-center gap-3 py-3 first:pt-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2 [&>svg]:size-[18px]">
                  <DocIcon type={spreadsheet.sourceType} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-text group-hover:text-primary">Arquivo original enviado pela Look</span>
                  <span className="block text-xs text-text-3">{spreadsheet.sourceType ? SOURCE_TYPE_LABEL[spreadsheet.sourceType] : ""} · Baixar arquivo</span>
                </span>
                <Download className="size-4 text-text-3" aria-hidden />
              </a>
            </li>
          ) : null}
        </ul>
      </CardBody>
    </Card>
  );
}
