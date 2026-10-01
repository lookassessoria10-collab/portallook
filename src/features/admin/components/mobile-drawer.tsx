"use client";

import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

/**
 * Gaveta de navegação mobile: popover manual no top layer + scroll-snap
 * horizontal (arrastar para fechar é nativo), fundo clicável e Esc.
 * O IntersectionObserver detecta o fechamento por gesto; abrir/fechar pelos
 * botões também atualiza o estado diretamente (com fallback por tempo).
 */
export function MobileDrawer({ children, label = "Menu" }: { children: ReactNode; label?: string }) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const finalizeClose = useCallback(() => {
    const drawer = drawerRef.current;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    if (drawer?.matches(":popover-open")) drawer.hidePopover();
    const main = document.getElementById("adm-main");
    if (main) main.inert = false;
    if (buttonRef.current?.getAttribute("aria-expanded") === "true") {
      buttonRef.current.setAttribute("aria-expanded", "false");
      buttonRef.current.focus();
    }
  }, []);

  const close = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return finalizeClose();
    scroller.scrollTo({ left: scroller.scrollWidth, behavior: "auto" });
    // Se a animação não concluir (aba em segundo plano, movimento reduzido), fecha assim mesmo.
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(finalizeClose, 450);
  }, [finalizeClose]);

  const open = useCallback(async () => {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    if (!drawer || !scroller) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    drawer.showPopover();
    const main = document.getElementById("adm-main");
    if (main) main.inert = true;
    buttonRef.current?.setAttribute("aria-expanded", "true");
    sheetRef.current?.focus({ preventScroll: true });
    if (!CSS.supports("scroll-initial-target", "nearest")) {
      scroller.scrollTo({ left: scroller.scrollWidth, behavior: "instant" });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    scroller.scrollTo({ left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const drawer = drawerRef.current;
    const sheet = sheetRef.current;
    const scroller = scrollerRef.current;
    if (!drawer || !sheet || !scroller) return;
    // Janela oculta/minimizada pode reportar largura 0 — 1/0 derrubaria o IntersectionObserver.
    const threshold = 1 / Math.max(window.innerWidth, 100);
    let seenOpen = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry || !drawer.matches(":popover-open")) return;
        if (entry.intersectionRatio >= 0.99) seenOpen = true;
        // Só fecha pelo gesto depois que o painel chegou a ficar aberto.
        if (seenOpen && entry.intersectionRatio < threshold) {
          seenOpen = false;
          finalizeClose();
        }
      },
      { root: drawer, threshold: [threshold, 0.99] },
    );
    observer.observe(sheet);

    // Fecha ao tocar fora do painel ou ao seguir um link de navegação.
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!sheet.contains(target) || target.closest("a[href]")) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawer.matches(":popover-open")) close();
    };
    drawer.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    let onScroll: (() => void) | null = null;
    if (!CSS.supports("animation-timeline: scroll()")) {
      onScroll = () => drawer.style.setProperty("--drawer-backdrop", String(1 - scroller.scrollLeft / sheet.offsetWidth));
      scroller.addEventListener("scroll", onScroll);
    }
    return () => {
      observer.disconnect();
      drawer.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      if (onScroll) scroller.removeEventListener("scroll", onScroll);
      const main = document.getElementById("adm-main");
      if (main) main.inert = false;
    };
  }, [close, finalizeClose]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        aria-label={label}
        aria-expanded="false"
        aria-controls="adm-drawer"
        className="grid size-10 place-items-center rounded-[10px] text-text-2 hover:bg-surface-2 hover:text-text lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <div ref={drawerRef} id="adm-drawer" popover="manual" className="drawer lg:hidden">
        <div ref={scrollerRef} className="drawer-scroller">
          <div ref={sheetRef} tabIndex={-1} className="drawer-sheet flex flex-col p-4 outline-none" aria-label="Menu principal" role="group">
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={close} aria-label="Fechar menu" className="grid size-10 place-items-center rounded-[10px] text-text-2 hover:bg-surface-2">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
