import { BookOpen } from "lucide-react";
import { formatInteger, formatPercent, formatValue, isFiniteNumber } from "@/lib/format/number";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DashboardSection } from "@/components/dashboard/section";
import { MetricCard } from "@/components/dashboard/metric-card";
import { KpiIcon } from "@/components/dashboard/kpi-icon";
import { MetricTrend } from "@/components/dashboard/metric-trend";
import { InsightList } from "@/components/dashboard/insight-list";
import { Delta } from "@/components/dashboard/delta";
import type { Insight } from "@/features/reports/schema";
import { signed, type SocialAudience, type SocialViewModel } from "@/features/social/view-model";

/**
 * Relatório de rede social de um mês: mesma linguagem visual do tráfego —
 * resumo com indicadores, blocos de detalhe, comparativo, evolução e insights.
 */
export function SocialDashboard({ vm, insights }: { vm: SocialViewModel; insights: Insight[] }) {
  const unit = vm.unit;
  const of = unit.feminine ? "da" : "do";
  return (
    <div className="space-y-8 sm:space-y-10">
      <DashboardSection id="resumo" title={`${vm.networkLabel} · resumo ${of} ${unit.singular}`} description={vm.headline}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {vm.kpis.map((k) => (
            <MetricCard key={k.key} label={k.label} value={k.value} format={k.format} comparison={k.comparison} reference={vm.reference} trend={k.trend} icon={<KpiIcon name={k.icon} />} description={k.description} footnote={k.footnote} />
          ))}
        </div>
        {vm.secondary.length ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {vm.secondary.map((k) => (
              <MetricCard key={k.key} size="compact" label={k.label} value={k.value} format={k.format} comparison={k.comparison} reference={vm.reference} description={k.description} footnote={k.footnote} />
            ))}
          </div>
        ) : null}
      </DashboardSection>

      {vm.audience || vm.interactions ? (
        <div className="grid gap-4 lg:grid-cols-12">
          {vm.audience ? <AudienceCard audience={vm.audience} reference={vm.reference} className={vm.interactions ? "lg:col-span-5" : "lg:col-span-12"} unitLabel={unit.singular} /> : null}
          {vm.interactions ? (
            <Card className={vm.audience ? "lg:col-span-7" : "lg:col-span-12"}>
              <CardHeader
                title="Interações com o conteúdo"
                subtitle={isFiniteNumber(vm.interactions.total) ? `${formatInteger(vm.interactions.total)} interações ${of} ${unit.singular}, por tipo` : `Interações ${of} ${unit.singular}, por tipo`}
              />
              <CardBody>
                <InteractionBars slices={vm.interactions.slices} />
                {vm.reference ? <p className="mt-3 text-xs text-text-3">Variações em relação a {vm.reference}.</p> : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        {vm.reference ? (
          <Card className="lg:col-span-5">
            <CardHeader title="Comparativo" subtitle={`${unit.singular.charAt(0).toUpperCase()}${unit.singular.slice(1)} atual vs. ${vm.reference}`} />
            <CardBody>
              <table className="w-full text-sm">
                <caption className="sr-only">Comparação com {unit.feminine ? "a" : "o"} {unit.singular} anterior</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-text-3">
                    <th scope="col" className="py-2 text-left font-semibold">
                      Métrica
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Atual
                    </th>
                    <th scope="col" className="py-2 pl-3 text-right font-semibold">
                      Variação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vm.comparisonRows.map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2.5 pr-2 text-left font-medium text-text-2">
                        {r.label}
                      </th>
                      <td className="py-2.5 text-right">
                        <span className="tabular block font-bold text-text">{formatValue(r.current, r.format)}</span>
                        {isFiniteNumber(r.previous) ? <span className="tabular block text-xs text-text-3">antes {formatValue(r.previous, r.format)}</span> : null}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <Delta comparison={r.comparison} showReference={false} className="justify-end" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        ) : null}
        <Card className={vm.reference ? "lg:col-span-7" : "lg:col-span-12"}>
          <CardHeader
            title="Evolução"
            subtitle={vm.trend ? `${unit.feminine ? "Últimas" : "Últimos"} ${vm.trend.points.length} ${unit.plural}` : `O histórico aparece a partir ${of} ${unit.feminine ? "segunda" : "segundo"} ${unit.singular} ${unit.feminine ? "publicada" : "publicado"}.`}
          />
          <CardBody>
            {vm.trend ? <MetricTrend points={vm.trend.points} series={vm.trend.series} currency="BRL" /> : <p className="py-10 text-center text-sm text-text-3">Ainda não há {unit.plural} anteriores para comparar.</p>}
          </CardBody>
        </Card>
      </div>

      {vm.extraMetrics.length ? (
        <DashboardSection id="outros-indicadores" title="Outros indicadores">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {vm.extraMetrics.map((e) => (
              <MetricCard key={e.key} size="compact" label={e.label} value={e.value} format="integer" comparison={e.comparison} reference={vm.reference} />
            ))}
          </div>
        </DashboardSection>
      ) : null}

      {insights.length ? (
        <DashboardSection id="insights" title="Insights da Look" description={`Leitura da equipe sobre ${unit.feminine ? "a" : "o"} ${unit.singular}`}>
          <InsightList insights={insights} />
        </DashboardSection>
      ) : null}

      {vm.glossary.length ? (
        <details className="group card">
          <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3.5 text-[15px] font-bold text-text sm:px-5">
            <BookOpen className="size-4 shrink-0 text-text-3" aria-hidden />
            O que significa cada métrica
            <span className="ml-auto text-xs font-semibold text-text-3 group-open:hidden">ver</span>
          </summary>
          <dl className="grid gap-x-6 gap-y-3 border-t border-border px-4 pb-4 pt-3.5 sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-3">
            {vm.glossary.map((g) => (
              <div key={g.key} className="min-w-0">
                <dt className="text-[13px] font-bold text-text">{g.label}</dt>
                <dd className="mt-0.5 text-[13px] leading-snug text-text-3">{g.description}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

/** Interações por tipo: barras com a participação no total e a variação de cada uma (mesmo desenho do ranking). */
function InteractionBars({ slices }: { slices: NonNullable<SocialViewModel["interactions"]>["slices"] }) {
  const max = Math.max(0, ...slices.map((s) => s.value));
  return (
    <ul className="space-y-3.5">
      {slices.map((s) => (
        <li key={s.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-text">
              <span className="truncate">{s.label}</span>
              {s.comparison ? <Delta comparison={s.comparison} showReference={false} className="shrink-0 text-xs" /> : null}
            </span>
            <span className="shrink-0">
              <span className="tabular font-bold text-text">{formatInteger(s.value)}</span>
              {s.share !== null ? <span className="tabular ml-1.5 text-xs text-text-3">{formatPercent(s.share, 0)}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-chart-track" aria-hidden>
            {s.value > 0 && max > 0 ? <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max((s.value / max) * 100, 1.5)}%` }} /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Seguidores do mês: entradas, saídas, saldo e o total antes × depois. */
function AudienceCard({ audience: a, reference, className, unitLabel }: { audience: SocialAudience; reference: string | null; className?: string; unitLabel: string }) {
  const max = Math.max(a.newFollowers ?? 0, a.lostFollowers ?? 0);
  const bar = (value: number | null, tone: string) => (
    <div className="mt-1.5 h-2 rounded-full bg-chart-track" aria-hidden>
      {isFiniteNumber(value) && value > 0 && max > 0 ? <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max((value / max) * 100, 1.5)}%` }} /> : null}
    </div>
  );
  return (
    <Card className={className}>
      <CardHeader title="Seguidores" subtitle={`Quem chegou e quem saiu no ${unitLabel}`} />
      <CardBody className="space-y-4">
        <ul className="space-y-3.5">
          {isFiniteNumber(a.newFollowers) ? (
            <li>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-text">Novos seguidores</span>
                <span className="tabular font-bold text-positive">{signed(a.newFollowers)}</span>
              </div>
              {bar(a.newFollowers, "bg-chart-1")}
            </li>
          ) : null}
          {isFiniteNumber(a.lostFollowers) ? (
            <li>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-text">Deixaram de seguir</span>
                <span className="tabular font-bold text-text-2">{a.lostFollowers ? signed(-a.lostFollowers) : "0"}</span>
              </div>
              {bar(a.lostFollowers, "bg-chart-other")}
            </li>
          ) : null}
        </ul>
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border px-3.5 py-3">
          {isFiniteNumber(a.netFollowers) ? (
            <div className="min-w-0">
              <dt className="truncate text-xs text-text-3">Saldo do {unitLabel}</dt>
              <dd className={`tabular text-[15px] font-bold ${a.netFollowers > 0 ? "text-positive" : a.netFollowers < 0 ? "text-negative" : "text-text"}`}>{signed(a.netFollowers)}</dd>
            </div>
          ) : null}
          {isFiniteNumber(a.followers) ? (
            <div className="min-w-0">
              <dt className="truncate text-xs text-text-3">Total no fim do {unitLabel}</dt>
              <dd className="tabular text-[15px] font-bold text-text">{formatInteger(a.followers)}</dd>
            </div>
          ) : null}
          {isFiniteNumber(a.previousFollowers) && reference ? (
            <div className="min-w-0">
              <dt className="truncate text-xs text-text-3">Total em {reference}</dt>
              <dd className="tabular text-[15px] font-bold text-text-2">{formatInteger(a.previousFollowers)}</dd>
            </div>
          ) : null}
          {a.growth !== null ? (
            <div className="min-w-0">
              <dt className="truncate text-xs text-text-3">Crescimento</dt>
              <dd className={`tabular text-[15px] font-bold ${a.growth > 0 ? "text-positive" : a.growth < 0 ? "text-negative" : "text-text"}`}>
                {a.growth > 0 ? "+" : a.growth < 0 ? "−" : ""}
                {formatPercent(Math.abs(a.growth))}
              </dd>
            </div>
          ) : null}
        </dl>
      </CardBody>
    </Card>
  );
}
