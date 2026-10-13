import type { InsightType } from "@/features/reports/schema";
import type { CommercialDashboardVM } from "@/features/commercial/dashboard";
import { DeltaPill, SectionLabel, TableFrame, cell, perReal } from "./parts";

const INSIGHT_COLOR: Record<InsightType, string> = {
  attention: "var(--attention)",
  positive: "var(--dash-2)",
  recommendation: "var(--primary)",
  neutral: "var(--dash-1)",
};

/** Cores do plano de ação, na ordem das prioridades. */
const PLAN_COLORS = ["var(--negative)", "var(--primary)", "var(--positive)", "var(--dash-2)", "var(--dash-3)", "var(--dash-4)"];

function Card({ color, tag, title, text, tinted }: { color: string; tag: string | null; title: string; text: string; tinted?: boolean }) {
  return (
    <article
      className="card min-w-0 border-l-[3px] p-5"
      style={{ borderLeftColor: color, background: tinted ? `color-mix(in srgb, ${color} 6%, var(--surface))` : undefined }}
    >
      {tag ? (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
          {tag}
        </p>
      ) : null}
      <h3 className="text-sm font-bold leading-snug text-text">{title}</h3>
      {text ? <p className="mt-2 text-[13px] leading-relaxed text-text-2">{text}</p> : null}
    </article>
  );
}

/** Insights da Look, comparativo com o período anterior, plano de ação e tabelas livres do mês em foco. */
export function InsightsPanel({ vm, currency }: { vm: CommercialDashboardVM; currency: string }) {
  const order: InsightType[] = ["attention", "positive", "neutral", "recommendation"];
  const insights = [...vm.insights].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const c = vm.comparison;
  return (
    <div className="space-y-9">
      {insights.length ? (
        <section aria-labelledby="diagnostico-titulo">
          <SectionLabel id="diagnostico-titulo">Diagnóstico de {vm.focus.name}</SectionLabel>
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((i) => (
              <Card key={i.id} color={INSIGHT_COLOR[i.type]} tag={i.tag} title={i.title} text={i.description} />
            ))}
          </div>
        </section>
      ) : null}

      {c ? (
        <section aria-labelledby="comparativo-titulo">
          <SectionLabel id="comparativo-titulo">
            Comparativo {c.previousName} vs {c.currentName}
          </SectionLabel>
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
        </section>
      ) : null}

      {vm.actionPlans.map((p) => (
        <section key={p.key} aria-labelledby={`plano-${p.key}`}>
          <SectionLabel id={`plano-${p.key}`}>{p.title}</SectionLabel>
          <div className="grid gap-3.5 md:grid-cols-2">
            {p.items.map((a, i) => (
              <Card key={`${i}-${a.title}`} color={PLAN_COLORS[i % PLAN_COLORS.length]} tag={a.tag} title={a.title} text={a.text} tinted />
            ))}
          </div>
        </section>
      ))}

      {vm.tables.map((t) => (
        <section key={t.key} aria-labelledby={`tabela-${t.key}`}>
          <SectionLabel id={`tabela-${t.key}`}>{t.title}</SectionLabel>
          <TableFrame caption={t.title}>
            <thead>
              <tr>
                {t.columns.map((col) => (
                  <th key={col} scope="col">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className="whitespace-normal">
                      {v || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableFrame>
        </section>
      ))}
    </div>
  );
}

function valuePerReal(v: number | null, currency: string) {
  return v == null ? "—" : `${perReal(v, currency)} / R$ 1`;
}
