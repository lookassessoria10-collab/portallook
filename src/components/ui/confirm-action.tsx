"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Dialog } from "./dialog";

/**
 * Botão que executa uma Server Action, opcionalmente com confirmação explícita
 * (para ações irreversíveis ou sensíveis: publicar, revogar, desativar...).
 */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "secondary",
  size = "md",
  className,
  successMessage,
  icon,
  onDone,
  ariaLabel,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: ReactNode;
  confirm?: { title: string; description: ReactNode; confirmLabel: string; tone?: "danger" | "primary" };
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  successMessage?: string;
  icon?: ReactNode;
  onDone?: () => void;
  /** Rótulo acessível — obrigatório na prática quando o botão só tem ícone. */
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = () =>
    startTransition(async () => {
      const result = await action();
      setOpen(false);
      if (result.ok) {
        toast.success(result.message ?? successMessage ?? "Feito.");
        onDone?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <>
      <Button variant={variant} size={size} className={className} disabled={pending} onClick={() => (confirm ? setOpen(true) : run())} aria-busy={pending} aria-label={ariaLabel} title={ariaLabel}>
        {icon}
        {children}
      </Button>
      {confirm ? (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={confirm.title}
          description={confirm.description}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button variant={confirm.tone === "danger" ? "danger" : "primary"} onClick={run} disabled={pending} aria-busy={pending}>
                {pending ? "Aguarde…" : confirm.confirmLabel}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}
