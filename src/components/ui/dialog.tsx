"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Diálogo modal nativo (<dialog> + showModal): foco preso, Esc e fundo clicável
 * (`closedby="any"`, com fallback para navegadores sem suporte).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    let handleClick: ((e: MouseEvent) => void) | null = null;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      handleClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        const inside = r.top <= event.clientY && event.clientY <= r.bottom && r.left <= event.clientX && event.clientX <= r.right;
        if (!inside) dialog.close();
      };
      dialog.addEventListener("click", handleClick);
    }
    return () => {
      dialog.removeEventListener("close", handleClose);
      if (handleClick) dialog.removeEventListener("click", handleClick);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      closedby="any"
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-[var(--radius-xl)] border border-border-strong bg-surface p-0 shadow-pop backdrop:bg-transparent",
        size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md",
      )}
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-lg font-bold text-text">
          {title}
        </h2>
        {description ? <div className="mt-1.5 text-sm leading-relaxed text-text-2">{description}</div> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      {footer ? <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div> : null}
    </dialog>
  );
}
