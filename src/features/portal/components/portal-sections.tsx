import Link from "next/link";
import { ChevronRight, Download, FileCode, FileSpreadsheet, FileText } from "lucide-react";
import { formatCurrency, formatInteger } from "@/lib/format/number";
import { lowerFirst } from "@/lib/format/text";
import { formatPeriod } from "@/lib/dates/period";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SOURCE_TYPE_LABEL, type ReportIndexEntry, type SourceType } from "@/features/reports/schema";

export interface PortalLinks {
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
  const spreadsheet = dataset && dataset.allowDownload && dataset.sourceType && ["xlsx", "xls", "csv", "html_structured"].includes(dataset.sourceType) ? dataset : null;
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
                  <span className="block truncate text-sm font-bold text-text group-hover:text-primary">Planilha com os dados do dashboard</span>
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

function historySummary(entry: ReportIndexEntry): string {
  const s = entry.summary;
  if (entry.kind === "document") return entry.sourceType ? `Relatório em ${SOURCE_TYPE_LABEL[entry.sourceType]}` : "Documento";
  if (entry.type === "commercial") {
    const parts: string[] = [];
    if (s.leads != null) parts.push(`${formatInteger(s.leads)} ${lowerFirst(entry.labels.firstStage ?? "leads")}`);
    if (s.conversions != null) parts.push(`${formatInteger(s.conversions)} ${lowerFirst(entry.labels.finalStage ?? "conversões")}`);
    if (s.revenue != null) parts.push(formatCurrency(s.revenue, "BRL", { noCents: true }));
    return parts.join(" · ");
  }
  const parts: string[] = [];
  if (s.investment != null) parts.push(`${formatCurrency(s.investment)} investidos`);
  if (s.results != null) parts.push(`${formatInteger(s.results)} resultados`);
  return parts.join(" · ");
}

/** Períodos anteriores publicados — um toque abre o período. */
export function HistoryList({ entries, current, links, draftIds }: { entries: ReportIndexEntry[]; current: string | null; links: PortalLinks; draftIds?: Set<string> }) {
  if (entries.length < 2) return null;
  return (
    <Card>
      <CardHeader title="Histórico" subtitle="Períodos anteriores" />
      <CardBody>
        <ul className="-mx-2 max-h-[420px] overflow-y-auto">
          {entries.map((e) => {
            const active = e.periodKey === current;
            return (
              <li key={e.id}>
                <Link
                  href={links.period(e.periodKey)}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn("flex items-center gap-3 rounded-xl px-2 py-2.5", active ? "bg-primary-soft" : "hover:bg-surface-2")}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("flex items-center gap-2 text-sm font-bold", active ? "text-primary" : "text-text")}>
                      {formatPeriod(e.period)}
                      {draftIds?.has(e.id) ? <Badge tone="attention">Rascunho</Badge> : null}
                    </span>
                    <span className="block truncate text-xs text-text-3">{historySummary(e)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
