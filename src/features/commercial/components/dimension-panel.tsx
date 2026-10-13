import type { CommercialDashboardVM, DimensionTab } from "@/features/commercial/dashboard";
import { notesFor } from "@/features/commercial/notes";
import { ChartPanel, DistributionPanel, NoteBox, Pill, RankBadge, SectionLabel, TableFrame, cell } from "./parts";

/** Um detalhamento (serviços, terapeutas…): participação, evolução e ranking acumulado. */
export function DimensionPanel({ dim, vm, currency }: { dim: DimensionTab; vm: CommercialDashboardVM; currency: string }) {
  const qty = dim.periodMeasureLabel;
  const isMoney = dim.rankedBy === "revenue" && dim.periodMeasureLabel === "Receita";
  return (
    <div className="space-y-9">
      {dim.distributions.length || dim.evolution ? (
        <section aria-labelledby={`dim-${dim.key}-titulo`}>
          <SectionLabel id={`dim-${dim.key}-titulo`} note={vm.rangeLabel}>
            {dim.label}
          </SectionLabel>
          <div className="grid gap-4 lg:grid-cols-2">
            {dim.distributions.map((d) => (
              <DistributionPanel key={d.key} spec={d} currency={currency} />
            ))}
            {dim.evolution ? <ChartPanel chart={dim.evolution} points={vm.points} currency={currency} height={300} className={dim.distributions.length === 1 ? undefined : "lg:col-span-2"} /> : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby={`dim-${dim.key}-ranking`}>
        <SectionLabel id={`dim-${dim.key}-ranking`} note={`ordenado por ${dim.rankedBy === "revenue" ? "receita" : qty.toLowerCase()}`}>
          Ranking — {dim.label}
        </SectionLabel>
        <TableFrame
          caption={`${dim.label}: acumulado e ${qty.toLowerCase()} por período`}
          footnote={dim.periods.length ? `Colunas dos meses: ${qty.toLowerCase()} de cada item. Status: o mais recente informado na planilha.` : undefined}
        >
          <thead>
            <tr>
              <th scope="col" className="w-12">
                #
              </th>
              <th scope="col">{dim.label}</th>
              {dim.periods.map((p) => (
                <th key={p.key} scope="col" className="text-right">
                  {p.label}
                </th>
              ))}
              {!isMoney ? <th scope="col" className="text-right">Total {qty.toLowerCase()}</th> : null}
              {dim.hasRevenue ? <th scope="col" className="text-right">Receita</th> : null}
              {dim.hasRevenue && !isMoney ? <th scope="col" className="text-right">Ticket médio</th> : null}
              {dim.hasRevenue ? <th scope="col" className="text-right">% da receita</th> : null}
              {dim.hasStatus ? <th scope="col">Status</th> : null}
            </tr>
          </thead>
          <tbody>
            {dim.rows.map((r) => (
              <tr key={r.key}>
                <td>
                  <RankBadge rank={r.rank} />
                </td>
                <th scope="row" className="text-left">
                  <span className="inline-flex items-center gap-2">
                    <span className="font-bold">{r.label}</span>
                    {r.isNew ? <Pill tone="info">Novo</Pill> : null}
                  </span>
                </th>
                {dim.periods.map((p) => (
                  <td key={p.key} className="tabular text-right text-text-2">
                    {cell(r.byPeriod[p.key], isMoney ? "currency" : "integer", currency)}
                  </td>
                ))}
                {!isMoney ? <td className="tabular text-right font-bold">{cell(r.quantity, "integer", currency)}</td> : null}
                {dim.hasRevenue ? <td className="tabular text-right font-bold">{cell(r.revenue, "currency", currency)}</td> : null}
                {dim.hasRevenue && !isMoney ? <td className="tabular text-right">{cell(r.averageTicket, "currency", currency)}</td> : null}
                {dim.hasRevenue ? <td className="tabular text-right text-text-2">{cell(r.share, "percent", currency)}</td> : null}
                {dim.hasStatus ? <td>{r.status ? <Pill tone={r.statusTone}>{r.status}</Pill> : <span className="text-text-3">—</span>}</td> : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <th scope="row" className="text-left">
                Total
              </th>
              {dim.periods.map((p) => (
                <td key={p.key} className="tabular text-right">
                  {cell(dim.total.byPeriod[p.key], isMoney ? "currency" : "integer", currency)}
                </td>
              ))}
              {!isMoney ? <td className="tabular text-right">{cell(dim.total.quantity, "integer", currency)}</td> : null}
              {dim.hasRevenue ? <td className="tabular text-right">{cell(dim.total.revenue, "currency", currency)}</td> : null}
              {dim.hasRevenue && !isMoney ? <td className="tabular text-right">{cell(dim.total.averageTicket, "currency", currency)}</td> : null}
              {dim.hasRevenue ? <td className="tabular text-right">100%</td> : null}
              {dim.hasStatus ? <td /> : null}
            </tr>
          </tfoot>
        </TableFrame>
        <NoteBox texts={notesFor(vm.notes, vm.layout, dim.label)} />
      </section>
    </div>
  );
}
