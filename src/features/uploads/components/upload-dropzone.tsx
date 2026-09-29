"use client";

import { FileSpreadsheet, FileText, FileCode, UploadCloud, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export const ACCEPT = ".xlsx,.xls,.csv,.pdf,.html,.htm";

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="size-5" />;
  if (ext === "html" || ext === "htm") return <FileCode className="size-5" />;
  return <FileSpreadsheet className="size-5" />;
}

function size(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Arrastar e soltar + seleção tradicional (teclado e toque funcionam pelo botão). */
export function UploadDropzone({ file, onFile, disabled, maxMb }: { file: File | null; onFile: (f: File | null) => void; disabled?: boolean; maxMb: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const hintId = useId();

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border-strong bg-surface-2 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden>
          <FileIcon name={file.name} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-text">{file.name}</p>
          <p className="text-xs text-text-3">{size(file.size)}</p>
        </div>
        {!disabled ? (
          <button type="button" onClick={() => onFile(null)} className="grid size-9 place-items-center rounded-lg text-text-3 hover:bg-surface-3 hover:text-text" aria-label="Remover arquivo">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !disabled) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed px-6 py-10 text-center transition-colors",
        over ? "border-primary bg-primary-soft" : "border-border-strong bg-bg-elevated/50 hover:border-[rgb(148_176_214/0.35)]",
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-primary" aria-hidden>
        <UploadCloud className="size-6" />
      </span>
      <div>
        <p className="text-[15px] font-bold text-text">Arraste o arquivo aqui</p>
        <p id={hintId} className="mt-1 text-[13px] text-text-3">
          XLSX, XLS, CSV, PDF ou HTML · até {maxMb} MB
        </p>
      </div>
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} aria-describedby={hintId} className="h-10 rounded-[10px] bg-surface-3 px-4 text-sm font-semibold text-text hover:bg-[#1b3358]">
        Selecionar arquivo
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
