import { CircleAlert, TriangleAlert } from "lucide-react";
import type { ValidationIssue } from "@/features/reports/schema";

/** ERRO impede a importação; AVISO permite continuar. Sempre com ícone + texto. */
export function ValidationList({ issues }: { issues: ValidationIssue[] }) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  return (
    <div className="space-y-4">
      {errors.length ? (
        <section aria-labelledby="val-errors">
          <h3 id="val-errors" className="mb-2 flex items-center gap-2 text-sm font-bold text-negative">
            <CircleAlert className="size-4" aria-hidden /> {errors.length === 1 ? "1 erro impede a importação" : `${errors.length} erros impedem a importação`}
          </h3>
          <ul className="space-y-2">
            {errors.map((e, i) => (
              <li key={i} className="rounded-xl border border-[rgb(255_123_139/0.25)] bg-negative-soft px-3.5 py-2.5 text-sm text-text">
                {e.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {warnings.length ? (
        <section aria-labelledby="val-warnings">
          <h3 id="val-warnings" className="mb-2 flex items-center gap-2 text-sm font-bold text-attention">
            <TriangleAlert className="size-4" aria-hidden /> {warnings.length === 1 ? "1 aviso" : `${warnings.length} avisos`} {warnings.length === 1 ? "(não impede a importação)" : "(não impedem a importação)"}
          </h3>
          <ul className="space-y-2">
            {warnings.map((w, i) => (
              <li key={i} className="rounded-xl border border-[rgb(246_189_91/0.2)] bg-attention-soft px-3.5 py-2.5 text-sm text-text-2">
                {w.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
