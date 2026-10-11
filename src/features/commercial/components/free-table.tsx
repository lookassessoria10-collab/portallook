import { Card } from "@/components/ui/card";
import type { CommercialTable } from "@/features/commercial/schema";

/**
 * Tabela livre do relatório (ex.: "Oportunidades abertas", "Plano de ação"), exibida
 * como veio da planilha. A primeira coluna fica fixa na rolagem horizontal do celular.
 */
export function FreeTable({ table }: { table: CommercialTable }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{table.title}</caption>
          <thead className="bg-surface-2 text-left text-xs text-text-3">
            <tr>
              {table.columns.map((c, i) => (
                <th key={`${c}-${i}`} scope="col" className={i === 0 ? "sticky left-0 z-[1] bg-surface-2 px-4 py-2.5 font-semibold" : "px-4 py-2.5 font-semibold"}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} className="border-t border-border align-top">
                {table.columns.map((_, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="sticky left-0 z-[1] bg-surface px-4 py-3 text-left font-semibold text-text">
                      {row[i] || "—"}
                    </th>
                  ) : (
                    <td key={i} className="min-w-[8rem] px-4 py-3 leading-snug text-text-2">
                      {row[i] || "—"}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
