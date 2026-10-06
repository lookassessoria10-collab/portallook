import { CalendarRange, Info, Target, TriangleAlert } from "lucide-react";
import { formatCurrency, formatInteger, formatPercent, formatValue, isFiniteNumber } from "@/lib/format/number";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DashboardSection } from "@/components/dashboard/section";
import { MetricCard } from "@/components/dashboard/metric-card";
import { KpiIcon } from "@/components/dashboard/kpi-icon";
import { InsightList } from "@/components/dashboard/insight-list";
import { Delta } from "@/components/dashboard/delta";
import type { Insight } from "@/features/reports/schema";
import type { MediaPlanBlock, MediaPlanSection } from "@/features/media-plan/schema";
import type { FigureView, MediaPlanViewModel, PlanExecutionRow, PlanItemView } from "@/features/media-plan/view-model";

/**
 * Plano de mídia do mês: quanto vai ser investido, onde, quando e com qual meta —
 * e, quando o tráfego do mês já foi publicado, quanto do plano foi executado.
 * Segue a organização do modelo "Estratégia de Mídia" da Look, no visual do portal.
 */
export function MediaPlanDashboard({ vm, insights, currency, trafficEnabled }: { vm: MediaPlanViewModel; insights: Insight[]; currency: string; trafficEnabled: boolean }) {
  const multiPlatform = vm.platforms.length > 1;
  return (
    <div className="space-y-8 sm:space-y-10">
      {vm.header ? (
        <header className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6">
          {vm.header.tagline ? <p className="eyebrow">{vm.header.tagline}</p> : null}
          {vm.header.title ? <h2 className="mt-1 text-xl font-bold leading-tight text-text sm:text-2xl">{vm.header.title}</h2> : null}
          {vm.header.summary ? <p className="mt-2 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-text-2">{vm.header.summary}</p> : null}
          {vm.header.tags.length ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Características do plano">
              {vm.header.tags.map((t) => (
                <li key={t} className="rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-[13px] font-semibold text-text-2">
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </header>
      ) : null}

      <DashboardSection id="resumo" title="Resumo do plano" description={vm.headline}>
        {vm.highlights.length ? (
          <FigureGrid figures={vm.highlights} reference={vm.reference} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {vm.kpis.map((k) => (
              <MetricCard
                key={k.key}
                label={k.label}
                value={k.value}
                format={k.format}
                currency={currency}
                comparison={k.comparison}
                reference={vm.reference}
                trend={k.trend.filter(isFiniteNumber).length >= 2 ? k.trend : undefined}
                icon={<KpiIcon name={k.icon} />}
                description={k.description}
                footnote={k.footnote}
              />
            ))}
          </div>
        )}
      </DashboardSection>

      {vm.topSections.map((s) => (
        <PlanSection key={s.key} section={s} />
      ))}

      {vm.execution ? (
        <DashboardSection
          id="realizado"
          title="Planejado × realizado"
          description={vm.execution.status === "partial" ? "Mês em andamento: o realizado considera o relatório de tráfego publicado até agora." : "Verba planejada contra o investimento do relatório de tráfego do mês."}
        >
          <Card>
            <CardBody className="pt-4 sm:pt-5">
              <ExecutionTable rows={[...vm.execution.investment, vm.execution.total]} currency={currency} totalKey="total" />
              {vm.execution.results.length ? (
                <div className="mt-5">
                  <h3 className="mb-2 text-[13px] font-semibold text-text-2">Resultados: meta × alcançado</h3>
                  <ExecutionTable rows={vm.execution.results} currency={currency} />
                </div>
              ) : null}
              {vm.execution.offlineBudget > 0 ? (
                <p className="mt-3 text-xs text-text-3">{formatCurrency(vm.execution.offlineBudget, currency)} do plano estão em veículos fora do relatório de tráfego e não entram neste comparativo.</p>
              ) : null}
            </CardBody>
          </Card>
        </DashboardSection>
      ) : vm.executionPending && trafficEnabled ? (
        <p className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-border px-4 py-3 text-[13px] text-text-3">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />O comparativo planejado × realizado aparece aqui quando o relatório de tráfego de {vm.periodLabel.toLowerCase()} for publicado.
        </p>
      ) : null}

      <DashboardSection id="orcamento" title="Orçamento" description={multiPlatform ? "Quanto de cada real planejado vai para cada plataforma ou veículo" : `Toda a verba está em ${vm.platforms[0]?.label ?? "uma plataforma"}`}>
        <div className={cn("grid gap-4", vm.campaigns.length > 1 && "lg:grid-cols-2")}>
          <Card>
            <CardHeader title="Por plataforma" />
            <CardBody>
              <ShareBar parts={vm.platforms.map((p) => ({ key: p.platform, label: p.label, share: p.share, color: p.color }))} />
              <ul className="mt-4 divide-y divide-border">
                {vm.platforms.map((p) => (
                  <li key={p.platform} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-text">{p.label}</span>
                      {p.description ? <span className="block text-[13px] leading-snug text-text-2">{p.description}</span> : null}
                      <span className="block text-xs text-text-3">
                        {p.itemCount} {p.itemCount === 1 ? "campanha" : "campanhas"}
                        {p.resultGroups.length ? ` · meta de ${p.resultGroups.map((g) => `${formatInteger(g.target)} ${g.label.toLowerCase()}`).join(" e ")}` : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="tabular block text-sm font-bold text-text">{formatCurrency(p.budget, currency)}</span>
                      <span className="tabular block text-xs text-text-3">{formatPercent(p.share, 0)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          {vm.campaigns.length > 1 ? (
            <Card>
              <CardHeader title="Por campanha" />
              <CardBody>
                <ShareBar parts={vm.campaigns.map((c) => ({ key: c.id, label: c.name, share: c.share, color: c.color }))} />
                <ul className="mt-4 divide-y divide-border">
                  {vm.campaigns.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text" title={c.name}>
                        {c.name}
                      </span>
                      <span className="tabular text-right text-sm font-bold text-text">{formatCurrency(c.budget, currency)}</span>
                      <span className="tabular w-11 text-right text-xs text-text-3">{formatPercent(c.share, 0)}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </DashboardSection>

      <DashboardSection id="campanhas" title="Campanhas" description={`${vm.metrics.itemCount} ${vm.metrics.itemCount === 1 ? "campanha planejada" : "campanhas e ações planejadas"} para ${vm.periodLabel.toLowerCase()}`}>
        <div className="space-y-4">
          {vm.platforms.map((p) => (
            <Card key={p.platform}>
              <CardHeader
                as="h3"
                title={
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
                    {p.label}
                  </span>
                }
                subtitle={`${formatCurrency(p.budget, currency)} planejados${multiPlatform ? ` · ${formatPercent(p.share, 0)} da verba` : ""}`}
              />
              <CardBody>
                <div className={cn("grid gap-3", p.items.length > 1 && "md:grid-cols-2 xl:grid-cols-3")}>
                  {p.items.map((item) => (
                    <PlanItemCard key={item.id} item={item} currency={currency} />
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </DashboardSection>

      {vm.timeline ? (
        <DashboardSection id="cronograma" title="Cronograma" description="Quando cada campanha ou ação fica no ar durante o mês">
          <Card>
            <CardBody className="pt-4 sm:pt-5">
              <div className="relative h-5 sm:ml-[38%]" aria-hidden>
                {vm.timeline.ticks.map((t) => (
                  <span key={t.label} className="absolute text-[11px] text-text-3" style={{ left: `${t.offset}%` }}>
                    {t.label}
                  </span>
                ))}
              </div>
              <ul className="space-y-3 sm:space-y-2">
                {vm.timeline.rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="min-w-0 sm:w-[38%] sm:pr-3">
                      <span className="block truncate text-[13px] font-semibold text-text" title={r.name}>
                        {r.name}
                      </span>
                      <span className="block truncate text-[11px] text-text-3">
                        {r.platformLabel} · {r.dateLabel}
                      </span>
                    </span>
                    <span className="relative h-3 flex-1 rounded-full bg-chart-track">
                      <span className="absolute inset-y-0 rounded-full" style={{ left: `${r.offset}%`, width: `${Math.min(r.width, 100 - r.offset)}%`, background: r.color }} />
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </DashboardSection>
      ) : null}

      {vm.goals.length ? (
        <DashboardSection id="metas" title="Metas do ciclo" description="O que esperamos alcançar com este plano">
          <FigureGrid figures={vm.goals} reference={vm.reference} icon={<Target className="size-4" aria-hidden />} />
          {vm.goalNotes.length ? (
            <div className="mt-4 space-y-4">
              {groupBlocks(vm.goalNotes).map((group, i) => (
                <BlockGroup key={i} blocks={group} />
              ))}
            </div>
          ) : null}
        </DashboardSection>
      ) : null}

      {vm.bottomSections.map((s) => (
        <PlanSection key={s.key} section={s} />
      ))}

      {insights.length ? (
        <DashboardSection id="insights" title="Recomendações da Look" description="Estratégia e pontos de atenção do plano">
          <InsightList insights={insights} />
        </DashboardSection>
      ) : null}
    </div>
  );
}

function FigureGrid({ figures, reference, icon }: { figures: FigureView[]; reference: string | null; icon?: React.ReactNode }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3", figures.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
      {figures.map((f) => (
        <li key={f.key} className="card @container flex min-w-0 flex-col gap-1.5 p-4 sm:p-5">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-text-2">
            {icon ? <span className="text-text-3">{icon}</span> : null}
            <span className="line-clamp-2">{f.label}</span>
          </span>
          <span className="tabular whitespace-nowrap text-[clamp(1.2rem,11cqi,1.75rem)] font-bold leading-tight tracking-tight text-text">{f.text}</span>
          {f.description ? <span className="text-xs leading-snug text-text-3">{f.description}</span> : null}
          {f.comparison && f.comparison.status !== "unavailable" ? <Delta comparison={f.comparison} reference={reference} /> : null}
        </li>
      ))}
    </ul>
  );
}

function ShareBar({ parts }: { parts: Array<{ key: string; label: string; share: number | null; color: string }> }) {
  return (
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-chart-track" role="img" aria-label={parts.map((p) => `${p.label}: ${formatPercent(p.share, 0)}`).join(", ")}>
      {parts.map((p) => (
        <span key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.share ?? 0) * 100}%`, background: p.color }} />
      ))}
    </div>
  );
}

function PlanItemCard({ item, currency }: { item: PlanItemView; currency: string }) {
  const details: Array<[string, string]> = [];
  if (item.objective) details.push(["Objetivo", item.objective]);
  if (item.funnel) details.push(["Funil", item.funnel]);
  if (item.audience) details.push(["Público", item.audience]);
  if (item.offers) details.push(["Ofertas", item.offers]);
  if (item.format) details.push(["Formato", item.format]);
  if (item.costPerResult !== null && item.resultText) details.push(["Custo esperado", `${formatCurrency(item.costPerResult, currency)} por resultado`]);
  if (isFiniteNumber(item.reachTarget)) details.push(["Alcance estimado", formatInteger(item.reachTarget)]);
  if (isFiniteNumber(item.impressionsTarget)) details.push(["Impressões estimadas", formatInteger(item.impressionsTarget)]);
  if (isFiniteNumber(item.clicksTarget)) details.push(["Cliques estimados", formatInteger(item.clicksTarget)]);
  return (
    <article className="card-inset flex min-w-0 flex-col gap-3 p-4">
      <header className="min-w-0">
        {item.dateLabel || (item.resultText && !isFiniteNumber(item.resultTarget)) ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {item.dateLabel ? (
              <Badge tone="neutral" icon={<CalendarRange />}>
                {item.dateLabel}
              </Badge>
            ) : null}
            {item.resultText && !isFiniteNumber(item.resultTarget) ? <Badge tone="neutral">{item.resultText}</Badge> : null}
          </div>
        ) : null}
        <h4 className="line-clamp-3 break-words text-[15px] font-bold leading-snug text-text" title={item.name}>
          {item.name}
        </h4>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-xl bg-surface px-3.5 py-3">
        <p>
          <span className="tabular block text-[22px] font-bold leading-none text-text">{formatCurrency(item.budget, currency)}</span>
          <span className="mt-1 block text-xs text-text-3">
            {isFiniteNumber(item.dailyBudget) ? `${formatCurrency(item.dailyBudget, currency)}/dia · ` : ""}
            {item.share !== null ? `${formatPercent(item.share, 0)} do plano` : "verba planejada"}
          </span>
        </p>
        {isFiniteNumber(item.resultTarget) && item.resultText ? (
          <p className="text-right">
            <span className="tabular block text-[15px] font-bold text-text">{item.resultText}</span>
            <span className="block text-xs text-text-3">meta</span>
          </p>
        ) : null}
      </div>
      {details.length ? (
        <dl className="grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
          {details.map(([k, v]) => (
            <div key={k} className={cn("min-w-0", v.length > 60 && "sm:col-span-2")}>
              <dt className="text-xs text-text-3">{k}</dt>
              <dd className="break-words font-medium text-text-2">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {item.notes ? <p className="whitespace-pre-line text-xs leading-relaxed text-text-3">{item.notes}</p> : null}
    </article>
  );
}

/** Agrupa blocos seguidos do mesmo formato (cartões viram grade, passos viram lista numerada…). */
function groupBlocks(blocks: MediaPlanBlock[]): MediaPlanBlock[][] {
  const groups: MediaPlanBlock[][] = [];
  for (const b of blocks) {
    const last = groups.at(-1);
    // Itens de lista só se juntam quando têm o mesmo título (é o título da lista).
    const joins = last && last[0].kind === b.kind && b.kind !== "text" && b.kind !== "callout" && b.kind !== "table" && (b.kind !== "item" || last[0].title === b.title);
    if (joins) last.push(b);
    else groups.push([b]);
  }
  return groups;
}

function PlanSection({ section }: { section: MediaPlanSection }) {
  return (
    <DashboardSection id={`secao-${section.key}`} title={section.title}>
      <div className="space-y-4">
        {groupBlocks(section.blocks).map((group, i) => (
          <BlockGroup key={i} blocks={group} />
        ))}
      </div>
    </DashboardSection>
  );
}

function BlockGroup({ blocks }: { blocks: MediaPlanBlock[] }) {
  const kind = blocks[0].kind;
  if (kind === "text") {
    const b = blocks[0];
    return (
      <div className="max-w-3xl">
        {b.title ? <h3 className="mb-1 text-[15px] font-bold text-text">{b.title}</h3> : null}
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-text-2">{b.text}</p>
      </div>
    );
  }
  if (kind === "callout") {
    const b = blocks[0];
    return (
      <aside className="flex gap-3 rounded-[var(--radius-lg)] border border-[rgb(140_156_248/0.25)] bg-info-soft px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p className="whitespace-pre-line text-sm leading-relaxed text-text-2">
          {b.title ? <strong className="text-text">{b.title}: </strong> : null}
          {b.text}
        </p>
      </aside>
    );
  }
  if (kind === "card") {
    return (
      <ul className={cn("grid gap-3", blocks.length > 1 && "md:grid-cols-2", blocks.length > 2 && "xl:grid-cols-3")}>
        {blocks.map((b, i) => (
          <li key={i} className="card flex flex-col gap-2 p-4">
            {b.title || b.tag ? (
              <div className="flex flex-wrap items-start justify-between gap-2">
                {b.title ? <strong className="text-[15px] leading-snug text-text">{b.title}</strong> : <span />}
                {b.tag ? <Badge tone="primary">{b.tag}</Badge> : null}
              </div>
            ) : null}
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-2">{b.text}</p>
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "step") {
    return (
      <ol className="card divide-y divide-border">
        {blocks.map((b, i) => (
          <li key={i} className="flex gap-3 p-4">
            <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-[13px] font-bold text-primary" aria-hidden>
              {i + 1}
            </span>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-2">
              {b.title ? <strong className="text-text">{b.title}. </strong> : null}
              {b.text}
            </p>
          </li>
        ))}
      </ol>
    );
  }
  if (kind === "item") {
    return (
      <div className="card p-4">
        {blocks[0].title ? <h3 className="mb-2 text-[15px] font-bold text-text">{blocks[0].title}</h3> : null}
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-text-2 marker:text-text-3">
          {blocks.map((b, i) => (
            <li key={i} className="whitespace-pre-line">
              {b.tag ? <strong className="text-text">{b.tag}: </strong> : null}
              {b.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (kind === "quote") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {blocks.map((b, i) => (
          <figure key={i} className="card border-l-4 border-l-primary p-4">
            {b.title ? <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-3">{b.title}</figcaption> : null}
            <blockquote className="whitespace-pre-line text-sm leading-relaxed text-text">{b.text}</blockquote>
          </figure>
        ))}
      </div>
    );
  }
  if (kind === "warning") {
    return (
      <div className="flex gap-3 rounded-[var(--radius-lg)] border border-[rgb(246_189_91/0.3)] bg-attention-soft p-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-attention" aria-hidden />
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-text-2 marker:font-semibold marker:text-attention">
          {blocks.map((b, i) => (
            <li key={i} className="whitespace-pre-line">
              {b.title ? <strong className="text-text">{b.title}. </strong> : null}
              {b.text}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (kind === "phase") {
    return (
      <ol className={cn("grid gap-3 sm:grid-cols-2", blocks.length >= 4 ? "lg:grid-cols-4 xl:grid-cols-5" : "lg:grid-cols-3")}>
        {blocks.map((b, i) => (
          <li key={i} className="card flex flex-col gap-1.5 border-t-2 border-t-primary p-4">
            <span className="text-xs font-semibold text-text-3">Fase {i + 1}</span>
            {b.title ? <strong className="text-[15px] text-text">{b.title}</strong> : null}
            {b.text
              .split(/\n|\s+\/\s+/)
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, j) => (
                <span key={j} className="text-[13px] leading-snug text-text-2">
                  {line}
                </span>
              ))}
          </li>
        ))}
      </ol>
    );
  }
  return <FreeTable block={blocks[0]} />;
}

/** Tabela como veio do arquivo: tabela no desktop, cartões no celular. */
function FreeTable({ block }: { block: MediaPlanBlock }) {
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-3">
              {block.columns.map((c) => (
                <th key={c} scope="col" className="px-4 py-2.5 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-b border-border align-top last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className={cn("px-4 py-2.5 leading-relaxed", j === 0 ? "font-semibold text-text" : "text-text-2")}>
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {block.rows.map((row, i) => (
          <li key={i} className="card p-4">
            <p className="text-[15px] font-bold text-text">{row[0] || "—"}</p>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              {row.slice(1).map((cell, j) =>
                cell ? (
                  <div key={j}>
                    <dt className="text-xs text-text-3">{block.columns[j + 1]}</dt>
                    <dd className="text-text-2">{cell}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

function ExecutionTable({ rows, currency, totalKey }: { rows: PlanExecutionRow[]; currency: string; totalKey?: string }) {
  const results = rows[0]?.format === "integer";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-text-3">
            <th scope="col" className="py-2 pr-3 text-left font-semibold">
              {results ? "Resultado" : "Plataforma"}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {results ? "Meta" : "Planejado"}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {results ? "Alcançado" : "Realizado"}
            </th>
            <th scope="col" className="w-[34%] py-2 pl-3 text-left font-semibold">
              Execução
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.rate === null ? null : Math.min(r.rate, 1.5);
            return (
              <tr key={r.key} className={cn("border-b border-border last:border-0", r.key === totalKey && "font-bold")}>
                <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-text">
                  <span className="flex items-center gap-2">
                    {r.color ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden /> : null}
                    {r.label}
                  </span>
                </th>
                <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-text-2">{r.planned === null ? "—" : formatValue(r.planned, r.format, currency)}</td>
                <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-text">{r.actual === null ? "—" : formatValue(r.actual, r.format, currency)}</td>
                <td className="py-2.5 pl-3">
                  {pct === null ? (
                    <span className="text-xs text-text-3">{r.planned === null ? "fora do plano" : "sem dado"}</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-chart-track">
                        {/* Verba acima do planejado pede atenção; resultado acima da meta é bom. */}
                        <span
                          className={cn("absolute inset-y-0 left-0 rounded-full", r.format === "currency" ? (pct > 1.05 ? "bg-attention" : "bg-primary") : pct >= 1 ? "bg-positive" : "bg-primary")}
                          style={{ width: `${(Math.min(pct, 1) * 100).toFixed(1)}%` }}
                        />
                      </span>
                      <span className="tabular w-12 text-right text-xs font-semibold text-text-2">{formatPercent(r.rate, 0)}</span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
