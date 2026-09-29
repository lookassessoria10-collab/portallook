"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, LoaderCircle, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { cn } from "@/lib/cn";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const ZOOMS = [1, 1.25, 1.5, 2, 2.5];

/**
 * Leitor de PDF responsivo: a página se ajusta à largura do aparelho (sem iframe
 * minúsculo no celular), com navegação por página, zoom e download opcional.
 */
export default function PdfViewer({ src, downloadHref, title }: { src: string; downloadHref?: string | null; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useCallback((delta: number) => setPage((p) => Math.min(Math.max(1, p + delta), pages || 1)), [pages]);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, left: 0 });
  }, [page]);

  const zoom = ZOOMS[zoomIndex];
  const pageWidth = width ? Math.min(width, 980) * zoom : undefined;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex items-center gap-1">
          <ToolbarButton label="Página anterior" onClick={() => go(-1)} disabled={page <= 1}>
            <ChevronLeft className="size-[18px]" />
          </ToolbarButton>
          <p className="tabular min-w-24 text-center text-sm font-semibold text-text-2" aria-live="polite">
            {pages ? `Página ${page} de ${pages}` : "Carregando…"}
          </p>
          <ToolbarButton label="Próxima página" onClick={() => go(1)} disabled={!pages || page >= pages}>
            <ChevronRight className="size-[18px]" />
          </ToolbarButton>
        </div>
        <div className="flex items-center gap-1">
          <ToolbarButton label="Diminuir zoom" onClick={() => setZoomIndex((z) => Math.max(0, z - 1))} disabled={zoomIndex === 0}>
            <ZoomOut className="size-[18px]" />
          </ToolbarButton>
          <span className="tabular w-12 text-center text-[13px] font-semibold text-text-3">{Math.round(zoom * 100)}%</span>
          <ToolbarButton label="Aumentar zoom" onClick={() => setZoomIndex((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIndex === ZOOMS.length - 1}>
            <ZoomIn className="size-[18px]" />
          </ToolbarButton>
          <ToolbarButton label="Ajustar à largura" onClick={() => setZoomIndex(0)} disabled={zoomIndex === 0}>
            <Maximize2 className="size-4" />
          </ToolbarButton>
          <a href={src} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text" aria-label="Abrir em nova aba" title="Abrir em nova aba">
            <ExternalLink className="size-4" aria-hidden />
          </a>
          {downloadHref ? (
            <a href={downloadHref} className="grid size-9 place-items-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text" aria-label="Baixar PDF" title="Baixar PDF">
              <Download className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        aria-label={`Documento: ${title}. Use as setas para trocar de página.`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
          if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
        }}
        className={cn("relative max-h-[78svh] min-h-[60svh] overflow-auto bg-[#1b2a42] p-2 sm:p-4", zoom > 1 ? "cursor-grab" : "")}
      >
        {error ? (
          <p className="py-20 text-center text-sm text-text-2">Não foi possível abrir este PDF. Tente abrir em nova aba.</p>
        ) : (
          <Document
            file={src}
            onLoadSuccess={({ numPages }) => {
              setPages(numPages);
              setPage(1);
            }}
            onLoadError={() => setError(true)}
            loading={<ViewerLoading />}
            error={<p className="py-20 text-center text-sm text-text-2">Não foi possível abrir este PDF.</p>}
            className="flex justify-center"
          >
            {pageWidth ? (
              <Page pageNumber={page} width={pageWidth} loading={<ViewerLoading />} className="overflow-hidden rounded-md shadow-pop" renderAnnotationLayer renderTextLayer />
            ) : null}
          </Document>
        )}
      </div>
    </div>
  );
}

function ViewerLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-text-3" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      Carregando documento…
    </div>
  );
}

function ToolbarButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="grid size-9 place-items-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-35">
      <span aria-hidden>{children}</span>
    </button>
  );
}
