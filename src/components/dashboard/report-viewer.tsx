"use client";

import dynamic from "next/dynamic";
import { Download, ExternalLink, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => <div className="skeleton h-[60svh] w-full" role="status" aria-label="Carregando visualizador" />,
});

export type ViewerSource = "pdf" | "html_legacy" | "html_structured" | "xlsx" | "xls" | "csv" | "seed";

/**
 * Escolhe o visualizador pelo formato do original. HTML legado roda em iframe
 * com sandbox SEM allow-same-origin: origem opaca, sem cookies/sessão/storage do portal.
 */
export function ReportViewer({ source, src, downloadHref, title }: { source: ViewerSource; src: string; downloadHref: string | null; title: string }) {
  if (source === "pdf") return <PdfViewer src={src} downloadHref={downloadHref} title={title} />;

  if (source === "html_legacy" || source === "html_structured") return <LegacyHtmlViewer src={src} title={title} downloadHref={downloadHref} />;

  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-text-2" aria-hidden>
        <FileSpreadsheet className="size-5" />
      </span>
      <div className="max-w-md">
        <p className="font-bold text-text">Planilha original</p>
        <p className="mt-1 text-sm text-text-3">Os dados desta planilha já estão organizados no dashboard. {downloadHref ? "Você também pode baixar o arquivo original." : "O download do arquivo original não está habilitado."}</p>
      </div>
      {downloadHref ? (
        <a href={downloadHref} className={buttonClass("primary")}>
          <Download className="size-4" aria-hidden /> Baixar planilha
        </a>
      ) : null}
    </div>
  );
}

export function LegacyHtmlViewer({ src, title, downloadHref }: { src: string; title: string; downloadHref?: string | null }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <p className="flex items-center gap-1.5 text-[13px] text-text-3">
          <ShieldCheck className="size-4" aria-hidden /> Relatório exibido em modo isolado
        </p>
        <div className="flex items-center gap-1">
          <a href={src} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
            <ExternalLink className="size-4" aria-hidden /> Tela cheia
          </a>
          {downloadHref ? (
            <a href={downloadHref} className={buttonClass("ghost", "sm")}>
              <Download className="size-4" aria-hidden /> Baixar
            </a>
          ) : null}
        </div>
      </div>
      <iframe
        src={src}
        title={title}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        loading="lazy"
        className="block h-[calc(100svh-12rem)] min-h-[520px] w-full bg-white"
      />
    </div>
  );
}
