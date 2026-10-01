import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatValue, type ValueFormat } from "@/lib/format/number";
import { cn } from "@/lib/cn";

export interface PeriodTableColumn {
  key: string;
  label: string;
  format: ValueFormat;
  /** Coluna principal do grupo (valor em destaque). */
  emphasis?: boolean;
}

export interface PeriodTableGroup {
  key: string;
  /** Sem rótulo, o cabeçalho tem uma linha só. */
  label: string | null;
  color?: string;
  columns: PeriodTableColumn[];
}

export interface PeriodTableData {
  groups: PeriodTableGroup[];
  rows: Array<{ key: string; label: string; values: Record<string, number | null> }>;
  total: Record<string, number | null> | null;
}

/**
 * Tabela período a período (meses nas linhas, indicadores nas colunas), com
 * total no rodapé. A primeira coluna fica fixa na rolagem horizontal do celular
 * e cada período leva ao seu detalhe.
 */
export function PeriodTable({ table, currency, caption, periodLabel, href }: { table: PeriodTableData; currency: string; caption: string; periodLabel: string; href: (periodKey: string) => string }) {
  const grouped = table.groups.some((g) => g.label);
  const columns = table.groups.flatMap((g, gi) => g.columns.map((c, ci) => ({ ...c, id: `${g.key}:${c.key}`, divider: gi > 0 && ci === 0 })));
  const cell = (divider: boolean) => cn("tabular whitespace-nowrap px-3 py-2.5 text-right", divider && "border-l border-border");

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-2 text-xs text-text-3">
          {grouped ? (
            <tr>
              <td className="sticky left-0 z-[1] bg-surface-2" />
              {table.groups.map((g, gi) => (
                <th key={g.key} scope="colgroup" colSpan={g.columns.length} className={cn("px-3 pb-1 pt-2.5 text-center font-bold text-text-2", gi > 0 && "border-l border-border")}>
                  <span className="inline-flex items-center gap-1.5">
                    {g.color ? <span className="size-2 rounded-full" style={{ background: g.color }} aria-hidden /> : null}
                    {g.label}
                  </span>
                </th>
              ))}
            </tr>
          ) : null}
          <tr>
            <th scope="col" className="sticky left-0 z-[1] bg-surface-2 px-3 py-2 text-left font-semibold">
              {periodLabel}
            </th>
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn("whitespace-nowrap px-3 py-2 text-right font-semibold", c.divider && "border-l border-border")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.key} className="group border-t border-border">
              <th scope="row" className="sticky left-0 z-[1] bg-surface p-0 text-left group-hover:bg-surface-2">
                <Link href={href(r.key)} className="flex items-center gap-1 whitespace-nowrap px-3 py-2.5 font-bold text-text hover:text-primary">
                  {r.label}
                  <ChevronRight className="size-3.5 text-text-3" aria-hidden />
                </Link>
              </th>
              {columns.map((c) => (
                <td key={c.id} className={cn(cell(c.divider), "group-hover:bg-surface-2", c.emphasis ? "font-bold text-text" : "font-medium text-text-2")}>
                  {formatValue(r.values[c.key] ?? null, c.format, currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {table.total ? (
          <tfoot>
            <tr className="border-t border-border-strong bg-surface-2">
              <th scope="row" className="sticky left-0 z-[1] bg-surface-2 px-3 py-2.5 text-left font-bold text-text">
                Total
              </th>
              {columns.map((c) => (
                <td key={c.id} className={cn(cell(c.divider), "font-bold text-text")}>
                  {formatValue(table.total?.[c.key] ?? null, c.format, currency)}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
