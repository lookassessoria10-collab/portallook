import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14", className)}>
      {icon ? (
        <div className="grid size-12 place-items-center rounded-2xl border border-border-strong bg-surface-2 text-text-3 [&>svg]:size-5" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm">
        <p className="text-[15px] font-bold text-text">{title}</p>
        {description ? <p className="mt-1 text-sm leading-relaxed text-text-3">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
