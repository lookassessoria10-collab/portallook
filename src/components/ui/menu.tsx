"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  tone?: "default" | "danger";
}

/**
 * Menu de ações em popover nativo (top layer, light-dismiss e Esc do navegador).
 * Posicionado por JS relativo ao botão, com inversão quando não cabe na tela.
 * Não usa role="menu" — é um grupo de botões/links revelado.
 */
export function ActionMenu({ items, label = "Mais ações", className }: { items: MenuItem[]; label?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const popoverId = `menu-${id}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Ancora pela borda direita do botão; não depende de medir o próprio menu.
  const position = useCallback(() => {
    const trigger = triggerRef.current;
    const pop = popRef.current;
    if (!trigger || !pop) return;
    const t = trigger.getBoundingClientRect();
    const gap = 6;
    const estimatedHeight = pop.getBoundingClientRect().height || items.length * 40 + 12;
    const below = t.bottom + gap;
    const top = below + estimatedHeight > window.innerHeight - 8 ? Math.max(8, t.top - gap - estimatedHeight) : below;
    pop.style.top = `${top}px`;
    pop.style.right = `${Math.max(8, window.innerWidth - t.right)}px`;
    pop.style.left = "auto";
  }, [items.length]);

  const close = () => popRef.current?.hidePopover?.();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={popoverId}
        aria-label={label}
        title={label}
        className={cn("grid size-9 place-items-center rounded-[10px] text-text-2 hover:bg-surface-2 hover:text-text", className)}
      >
        <MoreHorizontal className="size-[18px]" aria-hidden />
      </button>
      <div
        ref={popRef}
        id={popoverId}
        popover="auto"
        className="menu-popover fixed"
        onToggle={(e) => {
          if ((e as unknown as ToggleEvent).newState === "open") position();
        }}
      >
        <div className="flex flex-col" role="group" aria-label={label}>
          {items.map((item) => {
            const cls = cn(
              "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium",
              item.tone === "danger" ? "text-negative hover:bg-negative-soft" : "text-text hover:bg-surface-3",
            );
            const content = (
              <>
                {item.icon ? <span className="text-text-3 [&>svg]:size-4" aria-hidden>{item.icon}</span> : null}
                {item.label}
              </>
            );
            if (item.href) {
              return (
                <Link key={item.label} href={item.href} className={cls} onClick={close} {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                className={cls}
                onClick={() => {
                  close();
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
