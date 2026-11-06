import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Seção do dashboard com título acessível (aria-labelledby). `hideTitle`: o título fica só para
 * leitores de tela (ex.: relatório em HTML que já traz o próprio cabeçalho).
 */
export function DashboardSection({
  id,
  title,
  description,
  actions,
  children,
  className,
  hideTitle,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("scroll-mt-28", className)} id={id}>
      {hideTitle ? (
        <h2 id={`${id}-title`} className="sr-only">
          {title}
        </h2>
      ) : (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-[17px] font-bold text-text sm:text-lg">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-[13px] leading-snug text-text-3">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
