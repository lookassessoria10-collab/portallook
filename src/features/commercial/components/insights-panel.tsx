import type { InsightType } from "@/features/reports/schema";
import type { CommercialDashboardVM } from "@/features/commercial/dashboard";
import { notesFor, unplacedNotes } from "@/features/commercial/notes";
import { NoteBox, SectionLabel } from "./parts";
import { ComparisonTable, FreeTable, LooseNotes, OpportunityBlock } from "./shared-blocks";

export const INSIGHT_COLOR: Record<InsightType, string> = {
  attention: "var(--attention)",
  positive: "var(--dash-2)",
  recommendation: "var(--primary)",
  neutral: "var(--dash-1)",
};

export const INSIGHT_ORDER: InsightType[] = ["attention", "positive", "neutral", "recommendation"];

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

/** Insights da Look, comparativo com o período anterior, agenda marcada, plano de ação e tabelas livres do mês em foco. */
export function InsightsPanel({ vm, currency }: { vm: CommercialDashboardVM; currency: string }) {
  const insights = [...vm.insights].sort((a, b) => INSIGHT_ORDER.indexOf(a.type) - INSIGHT_ORDER.indexOf(b.type));
  const c = vm.comparison;
  const notes = (slot: string) => notesFor(vm.notes, vm.layout, slot);
  const loose = unplacedNotes(vm.notes, vm.layout, vm.dimensions.map((d) => d.label));
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
          <ComparisonTable comparison={c} currency={currency} />
          <NoteBox texts={notes("comparativo")} />
        </section>
      ) : null}

      {vm.opportunities.map((o) => (
        <section key={o.key} aria-labelledby={`oportunidade-${o.key}`}>
          <SectionLabel id={`oportunidade-${o.key}`} note="oportunidades abertas">
            {o.title}
          </SectionLabel>
          <OpportunityBlock opportunity={o} focusName={vm.focus.name} nextName={vm.nextName} currency={currency} notes={notes("oportunidades")} />
        </section>
      ))}

      {vm.actionPlans.map((p) => (
        <section key={p.key} aria-labelledby={`plano-${p.key}`}>
          <SectionLabel id={`plano-${p.key}`}>{p.title}</SectionLabel>
          <div className="grid gap-3.5 md:grid-cols-2">
            {p.items.map((a, i) => (
              <Card key={`${i}-${a.title}`} color={PLAN_COLORS[i % PLAN_COLORS.length]} tag={a.tag} title={a.title} text={a.text} tinted />
            ))}
          </div>
          <NoteBox texts={notes("plano")} />
        </section>
      ))}

      {vm.tables.map((t) => (
        <section key={t.key} aria-labelledby={`tabela-${t.key}`}>
          <SectionLabel id={`tabela-${t.key}`}>{t.title}</SectionLabel>
          <FreeTable table={t} />
        </section>
      ))}

      {loose.length ? (
        <section aria-labelledby="notas-titulo">
          <SectionLabel id="notas-titulo">Notas da Look</SectionLabel>
          <LooseNotes notes={loose} />
        </section>
      ) : null}
    </div>
  );
}
