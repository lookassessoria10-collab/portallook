import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "positive" | "negative" | "attention" | "info" | "primary" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-text-2",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  attention: "bg-attention-soft text-attention",
  info: "bg-info-soft text-info",
  primary: "bg-primary-soft text-primary",
  muted: "bg-transparent text-text-3 border border-border-strong",
};

export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold", tones[tone], className)}>
      {icon ? <span className="-ml-0.5 [&>svg]:size-3.5" aria-hidden>{icon}</span> : null}
      {children}
    </span>
  );
}
