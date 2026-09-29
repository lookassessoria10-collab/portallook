import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("card min-w-0", className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  actions,
  icon,
  className,
  as: Heading = "h2",
  id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
  id?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-text-3" aria-hidden>{icon}</span> : null}
        <div className="min-w-0">
          <Heading id={id} className="text-[15px] font-bold leading-snug text-text sm:text-base">
            {title}
          </Heading>
          {subtitle ? <p className="mt-0.5 text-[13px] leading-snug text-text-3">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4 pt-3 sm:px-5 sm:pb-5", className)} {...props} />;
}
