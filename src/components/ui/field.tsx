import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[10px] border border-border-strong bg-bg-elevated px-3 text-[15px] text-text placeholder:text-text-3 transition-colors hover:border-[rgb(148_176_214/0.3)] focus:border-border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 aria-invalid:border-negative disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-text-2">
        {label}
        {optional ? <span className="ml-1 font-normal text-text-3">(opcional)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[13px] font-medium text-negative" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-text-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-11 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-3" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Checkbox({ label, description, className, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-[10px] py-1", className)}>
      <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-[var(--primary)]" {...props} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text">{label}</span>
        {description ? <span className="mt-0.5 block text-[13px] text-text-3">{description}</span> : null}
      </span>
    </label>
  );
}
