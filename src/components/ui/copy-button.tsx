"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

export function CopyButton({
  value,
  label = "Copiar link",
  variant = "secondary",
  size = "md",
  className,
  iconOnly,
}: {
  value: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };
  return (
    <Button variant={variant} size={iconOnly ? "icon" : size} className={className} onClick={copy} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}>
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {iconOnly ? null : copied ? "Copiado" : label}
    </Button>
  );
}
