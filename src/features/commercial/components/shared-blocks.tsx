import type { ReactNode } from "react";
import { normalizeText } from "@/lib/ids";
import type { CommercialDashboardVM, OpportunityView } from "@/features/commercial/dashboard";
import type { CommercialData, SectionNote } from "@/features/commercial/schema";
import { DeltaPill, NoteBox, Pill, TableFrame, cell, perReal } from "./parts";

/** Comparativo do mês em foco com o anterior, com a leitura da Look ao lado de cada indicador. */
export function ComparisonTable({ comparison: c, currency }: { comparison: NonNullable<CommercialDashboardVM["comparison"]>; currency: string }) {
  return (
    <TableFrame caption={`Comparativo ${c.previousName} e ${c.currentName}`}>
      <thead>
        <tr>
          <th scope="col">Indicador</th>
          <th scope="col" className="text-right">
            {c.previousName}
          </th>
          <th scope="col" className="text-right">
            {c.currentName}
          </th>
          <th scope="col" className="text-center">
            Variação
          </th>
          {c.hasNotes ? <th scope="col">Leitura</th> : null}
        </tr>
      </thead>
      <tbody>
        {c.rows.map((r) => (
          <tr key={r.key}>
            <th scope="row" className="text-left font-bold">
              {r.label}
            </th>
            <td className="tabular text-right text-text-2">{r.perReal ? valuePerReal(r.previous, currency) : cell(r.previous, r.format, currency)}</td>
            <td className="tabular text-right font-bold">{r.perReal ? valuePerReal(r.current, currency) : cell(r.current, r.format, currency)}</td>
            <td className="text-center">
              <DeltaPill delta={r.delta} />
            </td>
            {c.hasNotes ? <td className="min-w-[260px] whitespace-normal text-xs leading-relaxed text-text-2">{r.note ?? ""}</td> : null}
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

function valuePerReal(v: number | null, currency: string) {
  return v == null ? "—" : `${perReal(v, currency)} / R$ 1`;
}

const URGENCY = /^(urgencia|prioridade|impacto)$/;

/** Selo para "Alta", "Média", "Baixa" nas colunas de urgência/prioridade. */
function urgencyTone(value: string) {
  const n = normalizeText(value);
  if (/^(alta|urgente|critica)/.test(n)) return "negative" as const;
  if (/^(media|moderada)/.test(n)) return "attention" as const;
  if (/^(baixa|tatica|rotina)/.test(n)) return "neutral" as const;
  return null;
}

/** Tabela livre como veio da planilha; urgência/prioridade em selo e a 1ª coluna "#" em negrito. */
export function FreeTable({ table, footnote }: { table: CommercialData["tables"][number]; footnote?: ReactNode }) {
  const badgeCols = table.columns.map((c) => URGENCY.test(normalizeText(c)));
  return (
    <TableFrame caption={table.title} footnote={footnote}>
      <thead>
        <tr>
          {table.columns.map((col) => (
            <th key={col} scope="col">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, i) => (
          <tr key={i}>
            {r.map((v, j) => {
              const tone = badgeCols[j] && v ? urgencyTone(v) : null;
              return (
                <td key={j} className={j === 0 && table.columns[0].trim() === "#" ? "font-bold" : "min-w-[120px] whitespace-normal"}>
                  {tone ? <Pill tone={tone}>{v}</Pill> : v || "—"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

/** Agenda já marcada para depois do mês, com a receita que ela representa. */
export function OpportunityBlock({ opportunity: o, focusName, nextName, currency, notes }: { opportunity: OpportunityView; focusName: string; nextName: string | null; currency: string; notes: string[] }) {
  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-text-3">
        Agendados depois do fechamento de {focusName}. Seguem como oportunidade aberta — não entram como falta nem como receita de {focusName}.
      </p>
      <FreeTable table={o.table} />
      {o.potential != null && o.count > 0 ? (
        <NoteBox
          label="Receita potencial"
          texts={[`${o.count} ${o.count === 1 ? "agendamento" : "agendamentos"} × ticket de ${cell(o.ticket, "currency", currency)} ≈ ${cell(o.potential, "currency", currency)} já encaminhados${nextName ? ` para ${nextName}` : ""}.`]}
        />
      ) : null}
      <NoteBox texts={notes} />
    </>
  );
}

/** Notas da aba Notas sem lugar no modelo do cliente. */
export function LooseNotes({ notes }: { notes: SectionNote[] }) {
  if (!notes.length) return null;
  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      {notes.map((n, i) => (
        <article key={i} className="card min-w-0 border-l-[3px] border-l-primary p-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{n.section}</p>
          <p className="text-[13px] leading-relaxed text-text-2">{n.text}</p>
        </article>
      ))}
    </div>
  );
}
