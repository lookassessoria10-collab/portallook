"use client";

import { useState, type ReactNode } from "react";
import { LazyDistributionChart } from "@/components/charts/lazy";
import { IsaborComparisonCharts, IsaborRoiChart } from "./original-commercial-charts";
import { isaborMonths, type IsaborMonth } from "@/features/commercial/reference-data";

/**
 * Reprodução da ORGANIZAÇÃO do dashboard HTML original da Dra. Isabor.
 * Só as cores/superfícies são do Portal Look. Os números vêm da mesma
 * referência histórica usada nas tabelas, sem alterar importações ou a Serenity.
 */
const brl = (v: number, decimals = 0) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(v);
const count = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const pcent = (v: number, decimals = 1) => new Intl.NumberFormat("pt-BR", {
  style: "percent", minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(v);
const times = (v: number) => new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(v) + "x";
const block = "min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5";
const panelTitle = "text-sm font-bold text-text sm:text-base";
const secondary = "text-xs leading-relaxed text-text-2";
const tabs = [
  ["geral", "Visão Geral"],
  ["comparativo", "Comparativo Mensal"],
  ["roi", "ROI & Canais"],
  ["diagnostico", "Diagnóstico"],
] as const;
type TabKey = typeof tabs[number][0];
const focusMonth = isaborMonths[4];
const sum = (key: keyof IsaborMonth) => isaborMonths.reduce((a, m) => a + (typeof m[key] === "number" ? m[key] as number : 0), 0);

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary">{children}</p>;
}
function Heading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return <div className="mb-4">
    <Eyebrow>{eyebrow}</Eyebrow>
    <h2 className="text-lg font-bold tracking-tight text-text sm:text-xl">{title}</h2>
    {subtitle ? <p className="mt-1 text-sm text-text-2">{subtitle}</p> : null}
  </div>;
}
function Panel({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return <article className={block}>
    <h3 className={panelTitle}>{title}</h3>
    {caption ? <p className="mb-3 mt-1 text-xs text-text-3">{caption}</p> : <div className="mb-3" />}
    {children}
  </article>;
}
function Highlight({ children, title = "Destaque" }: { children: ReactNode; title?: string }) {
  return <div className="rounded-xl border border-primary/25 bg-primary-soft/60 px-4 py-3 text-sm leading-relaxed text-text-2">
    <strong className="mr-1 text-primary">{title}:</strong>{children}
  </div>;
}
function SeptemberHero() {
  const kpis = [
    { label: "Leads", value: "130", delta: "▼ 49,4% vs Ago", up: false },
    { label: "Comparecimentos", value: "18", delta: "▲ 125,0% vs Ago", up: true },
    { label: "Receita", value: brl(7750), delta: "▲ 127,9% vs Ago", up: true },
    { label: "Ticket Médio", value: brl(7750 / 18), delta: "▲ R$ 6 vs Ago", up: true },
    { label: "Conversão L→C", value: "13,8%", delta: "▲ 10,7pp vs Ago", up: true },
  ];
  return <section className="rounded-2xl border border-primary/30 bg-[var(--hero-gradient)] px-5 py-6 text-white shadow-sm sm:px-6">
    <div className="grid gap-5 sm:grid-cols-[minmax(155px,210px)_1fr] sm:items-center">
      <div className="sm:border-r sm:border-white/20 sm:pr-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Mês atual</p>
        <h2 className="mt-1.5 font-serif text-2xl font-bold tracking-tight">Setembro 2026</h2>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-3">
        {kpis.map((k) => <div key={k.label}>
          <strong className="block text-xl font-extrabold leading-tight sm:text-2xl">{k.value}</strong>
          <p className="text-[10px] uppercase tracking-wide text-white/65">{k.label}</p>
          <p className={"mt-0.5 text-[11px] font-semibold " + (k.up ? "text-emerald-300" : "text-rose-300")}>{k.delta}</p>
        </div>)}
      </div>
    </div>
  </section>;
}
function Totals() {
  const items = [
    ["Leads", count(sum("leads")), "Mai → Set"],
    ["Agendamentos", count(sum("bookings")), "10,8% dos leads"],
    ["Comparecimentos", count(sum("attended")), "com receita"],
    ["Receita total", brl(sum("revenue")), "Mai → Set"],
    ["Ticket médio", brl(sum("revenue") / sum("attended")), "média dos 5 meses"],
    ["Investimento", brl(sum("spend")), "Meta + Google"],
  ];
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
    {items.map(([label, value, note]) => <article key={label}
      className={"rounded-xl border p-4 shadow-sm " + (label === "Receita total" ? "border-primary/40 bg-primary-soft" : "border-border bg-surface")}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-text">{value}</p>
      <p className="mt-1 text-xs text-text-2">{note}</p>
    </article>)}
  </div>;
}
function Funnel() {
  const steps = [
    { label: "Leads", total: 130, width: "100%", color: "var(--chart-1)" },
    { label: "Agendamentos", total: 23, width: "76%", color: "var(--chart-2)" },
    { label: "Comparecimentos", total: 18, width: "60%", color: "var(--chart-3)" },
  ];
  const changes = ["17,7% · Lead → Agendamento", "78,3% · Agendamento → Comparecimento"];
  return <Panel title="Funil de conversão" caption="Do primeiro contato à consulta com receita.">
    <div className="space-y-2">
      {steps.map((s, i) => <div key={s.label}>
        {i > 0 ? <p className="my-1 text-center text-[11px] font-semibold text-primary">↓ {changes[i-1]}</p> : null}
        <div className="mx-auto flex min-h-14 items-center justify-between gap-3 rounded-xl px-4 text-white" style={{ width:s.width, background:s.color }}>
          <span className="text-sm font-bold">{s.label}</span>
          <strong className="text-xl">{s.total}</strong>
        </div>
      </div>)}
    </div>
    <p className="mt-4 text-center text-sm font-semibold text-primary">Lead → Paciente: 13,8%</p>
  </Panel>;
}
function Rates() {
  const rates = [
    ["Lead → Agendamento", 23 / 130],
    ["Agendamento → Comparecimento", 18 / 23],
    ["Lead → Paciente", 18 / 130],
  ] as const;
  return <Panel title="Taxas de conversão — Setembro" caption="Eficiência por etapa do funil.">
    <div className="space-y-7 py-3">
      {rates.map(([name, value]) => <div key={name}>
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-text-2">{name}</span><strong className="text-base text-text">{pcent(value)}</strong>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-primary" style={{ width: pcent(value, 2) }} /></div>
      </div>)}
    </div>
  </Panel>;
}
type Slice = { key: string; label: string; value: number; color: string };
const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
function Doughnut({ entries, format = "currency" }: { entries: Array<[string, number]>; format?: "currency" | "integer" }) {
  const slices: Slice[] = entries.map(([label, value], i) => ({ key: String(i), label, value, color:palette[i%palette.length] }));
  return <LazyDistributionChart slices={slices} kind="donut" currency="BRL" format={format} height={230}/>;
}
function CompactTable({ cols, rows, total }: { cols: string[]; rows: Array<Array<ReactNode>>; total?: Array<ReactNode> }) {
  return <div className="overflow-x-auto rounded-xl border border-border">
    <table className="min-w-full text-left text-xs">
      <thead className="bg-surface-2 text-[10px] font-bold uppercase tracking-wide text-text-3">
        <tr>{cols.map((c, i) => <th key={i} scope="col" className={"whitespace-nowrap px-3 py-2 " + (i ? "text-right" : "text-left")}>{c}</th>)}</tr>
      </thead>
      <tbody>{rows.map((row,i)=><tr key={i} className="border-t border-border">
        {row.map((v,j)=><td key={j} className={"whitespace-nowrap px-3 py-2.5 text-text-2 " + (j?"text-right tabular-nums":"text-left font-medium")}>{v}</td>)}
      </tr>)}</tbody>
      {total ? <tfoot className="border-t-2 border-primary/30 bg-primary-soft/50 font-bold text-text"><tr>{total.map((v,i)=><td key={i} className={"whitespace-nowrap px-3 py-2.5 "+(i?"text-right":"text-left")}>{v}</td>)}</tr></tfoot> : null}
    </table>
  </div>;
}
function MonthlyFocus() {
  return <>
    <div><Heading eyebrow="01 — Acumulado 2026" title="Indicadores consolidados — Maio a Setembro"/><Totals/></div>
    <div><Heading eyebrow="02 — Setembro 2026 em detalhe" title="Funil e conversão do mês"/>
      <div className="grid gap-4 lg:grid-cols-2"><Funnel/><Rates/></div>
      <div className="mt-3"><Highlight>Com metade dos leads de Agosto (257→130), os comparecimentos mais que dobraram (8→18). A conversão Lead → Paciente saltou de 3,1% para 13,8% — a melhor do ano. Menos volume, muito mais qualidade.</Highlight></div>
    </div>
    <div><Heading eyebrow="03 — Mídia e receita" title="Investimento e retorno por canal — Setembro"/>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Investimento em mídia" caption="Distribuição entre canais pagos.">
          <Doughnut entries={[["Meta Ads (Instagram)",697.9],["Google Ads",346.55]]}/>
          <CompactTable cols={["Canal","Investimento"]} rows={[["Meta Ads (Instagram)",brl(697.9,2)],["Google Ads",brl(346.55,2)]]} total={["Total",brl(1044.45,2)]}/>
        </Panel>
        <Panel title="Receita por canal" caption="Origem dos R$ 7.750,00 em Setembro.">
          <Doughnut entries={[["Indicação",3750],["Instagram",3550],["Google",450]]}/>
          <CompactTable cols={["Canal","Comp.","Receita"]} rows={[["Indicação",9,brl(3750,2)],["Instagram",8,brl(3550,2)],["Google",1,brl(450,2)],["Doctoralia",0,brl(0,2)]]} total={["Total",18,brl(7750,2)]}/>
        </Panel>
      </div>
      <div className="mt-3"><Highlight>Instagram virou canal de receita: 8 pacientes e R$ 3.550 (45,8% do mês), contra no máximo 1 paciente por mês até Agosto. Indicação segue líder, com 48,4% da receita e 60% de conversão. A mídia paga devolveu R$ 4.000 sobre R$ 1.044 investidos (3,83x).</Highlight></div>
    </div>
    <div><Heading eyebrow="04 — Distribuição de leads" title="Volume de leads por canal — Setembro"/>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Leads por canal" caption="130 leads captados no período.">
          <Doughnut format="integer" entries={[["Instagram",89],["Google",26],["Indicação",15]]}/>
        </Panel>
        <Panel title="Leitura estratégica" caption="O que os números dizem sobre canais.">
          <CompactTable cols={["Canal","Leads","Comp.","Conversão"]} rows={[["Instagram",89,8,"9,0%"],["Google",26,1,"3,8%"],["Indicação",15,9,"60%"],["Doctoralia",0,0,"—"],["Outros",0,0,"—"]]}/>
        </Panel>
      </div>
      <div className="mt-3"><Highlight title="Insight">Instagram caiu de 217 para 89 leads, mas a conversão foi de 0,5% para 9,0% — 8 pacientes contra 1 em Agosto. Indicação, com só 11,5% dos leads, trouxe 50% dos pacientes (60% de conversão). Google voltou a gerar receita pela primeira vez desde Maio.</Highlight></div>
    </div>
  </>;
}

type YearRow = { label: string; values: string[]; total: string; attention?: boolean };
type YearGroup = { title: string; rows: YearRow[] };
const each = (fn: (m: IsaborMonth, i: number) => string) => isaborMonths.map(fn);
const row = (label: string, values: string[], total: string): YearRow => ({ label, values, total });
function AnnualTable() {
  const groups: YearGroup[] = [
    { title:"Funil", rows:[
      row("Leads gerados",each(m=>count(m.leads)),"695"),
      row("Agendamentos",each(m=>count(m.bookings)),"75"),
      row("Comparecimentos",each(m=>count(m.attended)),"55"),
    ] },
    { title:"Conversões", rows:[
      row("Lead → Agendamento",each(m=>pcent(m.bookings/m.leads)),"10,8%"),
      row("Agend. → Comparec.",each(m=>pcent(m.attended/m.bookings)),"73,3%"),
      row("Lead → Paciente",each(m=>pcent(m.attended/m.leads)),"7,9%"),
    ] },
    { title:"Financeiro", rows:[
      row("Receita",each(m=>brl(m.revenue)),"R$ 23.400"),
      row("Ticket médio",each(m=>brl(m.revenue/m.attended,2)),"R$ 425,45"),
      row("Investimento total",each(m=>brl(m.spend,2)),"R$ 6.001,87"),
    ] },
    { title:"Mídia paga", rows:[
      row("Meta Ads (Instagram)",each(m=>brl(m.metaSpend,2)),"R$ 2.201,58"),
      row("Google Ads",each(m=>brl(m.googleSpend,2)),"R$ 3.801,29"),
    ] },
    { title:"ROI", rows:[
      row("ROI Geral",each(m=>times(m.revenue/m.spend)),"3,90x"),
      row("ROI Google",each(m=>times(m.googleRevenue/m.googleSpend)),"0,33x"),
      row("ROI Instagram",each(m=>times(m.metaRevenue/m.metaSpend)),"2,23x"),
    ] },
    { title:"Receita por canal", rows:[
      row("Indicação",each(m=>brl(m.referralRevenue)),"R$ 15.050"),
      row("Google Ads",each(m=>brl(m.googleRevenue)),"R$ 1.250"),
      row("Instagram/Meta",each(m=>brl(m.metaRevenue)),"R$ 4.900"),
      row("Doctoralia",each(m=>brl(m.doctoraliaRevenue)),"R$ 1.750"),
      row("Outros",each((m,i)=>i<2?"—":brl(m.otherRevenue)),"R$ 450"),
    ] },
  ];
  const months=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set ★","Out","Nov","Dez"];
  return <div className={block}>
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-[1050px] w-full border-separate border-spacing-0 text-[11px]">
        <thead><tr className="bg-surface-3">
          <th scope="col" className="sticky left-0 z-10 min-w-40 bg-surface-3 px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wide text-text">Indicador</th>
          {months.map((m,i)=><th key={m} scope="col" className={"px-2 py-3 text-center font-bold "+(i===8?"bg-primary text-on-primary":"text-text-2")}>{m}</th>)}
          <th className="px-2 py-3 text-right text-text" scope="col">Acum.</th>
        </tr></thead>
        <tbody>{groups.map(g=><FragmentGroup key={g.title} group={g}/>)}</tbody>
      </table>
    </div>
    <p className="mt-3 text-xs text-text-3">Meses em branco (—) ainda não possuem dados. A tabela será atualizada mensalmente.</p>
  </div>;
}
function FragmentGroup({group}:{group:YearGroup}) {
  return <>
    <tr><th colSpan={14} className="border-t border-border bg-primary-soft/40 px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-wider text-primary">{group.title}</th></tr>
    {group.rows.map(r=><tr key={r.label}>
      <th scope="row" className="sticky left-0 z-[1] border-t border-border bg-surface px-3 py-3 text-left font-semibold text-text">{r.label}</th>
      {["—","—","—","—",...r.values,"—","—","—"].map((v,i)=><td key={i} className={"border-t border-border px-2 py-3 text-right tabular-nums "+(i===8?"bg-primary-soft font-bold text-text":"text-text-2")}>{v}</td>)}
      <td className="border-t border-border px-2 py-3 text-right font-bold tabular-nums text-text">{r.total}</td>
    </tr>)}
  </>;
}
function Comparison() {
  return <>
    <div><Heading eyebrow="Comparativo Mensal 2026" title="Evolução de todos os indicadores por mês"/><AnnualTable/></div>
    <div><Heading eyebrow="Visualização gráfica" title="Tendência dos principais indicadores"/><IsaborComparisonCharts/></div>
  </>;
}
function RoiSummary() {
  return <div className="grid items-center gap-6 rounded-2xl border border-primary/30 bg-[var(--focus-gradient)] p-5 sm:p-7 lg:grid-cols-[230px_1fr]">
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/65">ROI acumulado (Mai–Set)</p>
      <strong className="mt-2 block text-5xl font-extrabold text-emerald-300">3,90x</strong>
      <p className="mt-2 text-xs text-white/70">R$ 23.400 em receita<br/>R$ 6.001,87 investidos</p>
    </div>
    <div className="space-y-3 text-sm leading-relaxed text-white/85">
      <p>Cada R$ 1,00 investido em mídia retornou <strong className="text-white">R$ 3,90 em receita</strong>.</p>
      <p>Setembro foi o melhor mês do ano, em ROI (<strong>7,42x</strong>) e receita (<strong>R$ 7.750</strong>), com o menor investimento da série (<strong>R$ 1.044</strong>).</p>
      <p>Só a receita vinda dos anúncios já cobriu o investimento <strong>3,83 vezes</strong>.</p>
    </div>
  </div>;
}
function RoiTable() {
  return <Panel title="ROI Geral · Google Ads · Instagram" caption="Investimento, receita e retorno sobre investimento por mês.">
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-[980px] w-full text-xs">
        <thead className="bg-surface-3 text-text-2"><tr>{["Mês","Invest. total","Receita","ROI geral","Invest. Google","Receita Google","ROI Google","Invest. Instagram","Receita Instagram","ROI Instagram"].map(h=><th key={h} className="whitespace-nowrap px-2 py-3 text-right first:text-left">{h}</th>)}</tr></thead>
        <tbody>{isaborMonths.map((m,i)=><tr key={m.label} className={i===4?"bg-primary-soft/50 font-semibold":""}>
          {[m.label+(i===4?" ★":""),brl(m.spend,2),brl(m.revenue,2),times(m.revenue/m.spend),brl(m.googleSpend,2),brl(m.googleRevenue,2),times(m.googleRevenue/m.googleSpend),brl(m.metaSpend,2),brl(m.metaRevenue,2),times(m.metaRevenue/m.metaSpend)].map((v,j)=><td key={j} className={"whitespace-nowrap border-t border-border px-2 py-3 text-right tabular-nums text-text "+(j===0?"text-left":"")}>{v}</td>)}
        </tr>)}</tbody>
        <tfoot className="border-t-2 border-primary/40 bg-primary-soft/40 font-bold">
          <tr>{["Acumulado",brl(6001.87,2),brl(23400,2),"3,90x",brl(3801.29,2),brl(1250,2),"0,33x",brl(2201.58,2),brl(4900,2),"2,23x"].map((v,j)=><td key={j} className={"whitespace-nowrap px-2 py-3 text-right text-text "+(j===0?"text-left":"")}>{v}</td>)}</tr>
        </tfoot>
      </table>
    </div>
  </Panel>;
}
function ChannelDetail() {
  return <div className="grid gap-3 lg:grid-cols-2">
    {isaborMonths.flatMap((m,i)=>[
      { label:"Google Ads", spend:m.googleSpend, revenue:m.googleRevenue, leads:m.googleLeads, visits:m.googleAttended, color:"var(--chart-2)" },
      { label:"Instagram/Meta", spend:m.metaSpend, revenue:m.metaRevenue, leads:m.metaLeads, visits:m.metaAttended, color:"var(--chart-1)" },
    ].map(ch=><article key={m.label+ch.label} className={block}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-text">{ch.label} — {m.label}{i===4?" ★":""}</p>
        <span className="size-3 shrink-0 rounded-full" style={{background:ch.color}}/>
      </div>
      <strong className={"mt-3 block text-2xl font-extrabold "+(ch.revenue>=ch.spend?"text-emerald-400":"text-rose-400")}>{times(ch.revenue/ch.spend)}</strong>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-xs">
        {[["Investimento",brl(ch.spend,2)],["Leads",String(ch.leads)],["Comparecimentos",String(ch.visits)],["Receita atribuída",brl(ch.revenue,2)]].map(([k,v])=><div key={k}><p className="text-text-3">{k}</p><strong className="mt-0.5 block text-text">{v}</strong></div>)}
      </div>
    </article>))}
  </div>;
}
function RoiAndChannels() {
  return <>
    <div><Heading eyebrow="ROI Geral" title="Retorno sobre investimento — acumulado 2026"/><RoiSummary/></div>
    <div><Heading eyebrow="ROI por mês" title="Evolução do retorno mês a mês"/><IsaborRoiChart/><div className="mt-4"><RoiTable/></div></div>
    <div><Heading eyebrow="Canal a canal" title="Performance detalhada por canal"/><ChannelDetail/>
      <div className="mt-4"><Highlight title="Leitura estratégica">Instagram: virada do ano — de 0,58x em Agosto para 5,09x em Setembro, com menos verba (R$ 770 → R$ 698) e 8 pacientes. Google Ads teve o primeiro retorno desde Maio (1,30x), mas o acumulado segue em 0,33x. Indicação, sem custo, gerou R$ 15.050 (64,3% da receita acumulada).</Highlight></div>
    </div>
  </>;
}
function Diagnosis() {
  const notes=[
    "Setembro foi o melhor mês do ano: 18 comparecimentos e R$ 7.750 com apenas 130 leads. A conversão Lead → Paciente passou de 3,1% para 13,8%. O ganho veio de qualidade e aproveitamento, não de volume.",
    "Instagram virou canal de receita: 8 pacientes, R$ 3.550 (45,8% do mês) e ROI de 5,09x, com menos verba que em Agosto. Até Agosto, o canal nunca havia ultrapassado 1 paciente por mês.",
    "Indicação segue o canal mais eficiente: 60% de conversão, 50% dos pacientes e 48,4% da receita do mês com custo zero. Acumulado: R$ 15.050 (64,3% da receita total).",
    "Google Ads voltou a gerar receita pela primeira vez desde Maio: 1 paciente e retorno de 1,30x. No acumulado, foram R$ 3.801 investidos e R$ 1.250 retornados (0,33x).",
    "Principais motivos de perda: valor da consulta, procura por planos de saúde, busca por exames específicos como colonoscopia e atendimento fora da região. A qualificação antes do contato segue prioritária.",
    "Doctoralia não gerou leads em Setembro. O canal trouxe R$ 1.750 no acumulado; vale conferir se o perfil e a agenda continuam ativos.",
  ];
  const actions: Array<[string,string,string,string]>=[
    ["1","Qualificar o lead antes do contato comercial — triagem para valor da consulta, planos e exames.","Reduzir perdas e preservar a conversão de 13,8%.","Alta"],
    ["2","Escalar Meta Ads com cautela — manter segmentação e criativos de Setembro.","Mais pacientes pelo canal com melhor retorno pago.","Alta"],
    ["3","Confirmar os 3 agendamentos de Outubro e fazer follow-up nos 112 leads não convertidos.","Garantir ~R$ 1.290 e recuperar parte dos leads parados.","Alta"],
    ["4","Fortalecer pedidos de indicação aos pacientes satisfeitos.","Ampliar o canal que responde por 64,3% da receita.","Média"],
    ["5","Manter Google Ads em observação e otimizar palavras-chave para consulta particular.","Avaliar se o retorno de Setembro se repete.","Média"],
  ];
  return <>
    <div><Heading eyebrow="Leitura estratégica" title="Diagnóstico consolidado — Setembro 2026"/>
      <div className="space-y-3">{notes.map((n,i)=><p key={i} className="rounded-xl border-l-4 border-primary bg-surface px-4 py-3 text-sm leading-relaxed text-text-2">{n}</p>)}</div>
    </div>
    <div><Heading eyebrow="Oportunidades abertas" title="Agendamentos já marcados para Outubro" subtitle="Consultas agendadas após o fechamento de setembro. Não entram como faltas nem como receita do mês."/>
      <Panel title="Próximos atendimentos">
        <CompactTable cols={["Origem","Data agendada","Situação"]} rows={[["Indicação","02/10/2026","Aguardando atendimento"],["Indicação","02/10/2026","Aguardando atendimento"],["Google","28/10/2026","Aguardando atendimento"]]}/>
        <p className="mt-3 text-sm text-text-2">Receita potencial: 3 consultas × ticket de R$ 430 ≈ <strong className="text-text">R$ 1.290</strong>.</p>
      </Panel>
    </div>
    <div><Heading eyebrow="Oportunidade de crescimento" title="Potencial com o volume de Agosto"/>
      <div className="grid gap-4 md:grid-cols-[1fr_210px]">
        <Panel title="257 leads × 13,8% de conversão" caption="Cenário mantendo o aproveitamento de Setembro">
          <p className="text-sm leading-relaxed text-text-2">~35 pacientes × ticket de R$ 430 = <strong className="text-text">~R$ 15.070</strong>. O desafio é ampliar o volume sem perder a qualificação, com investimento na faixa de agosto (R$ 1.208).</p>
        </Panel>
        <article className="rounded-2xl border border-primary/30 bg-primary-soft p-5">
          <p className="text-xs font-bold uppercase text-text-3">Crescimento potencial</p>
          <strong className="mt-2 block text-4xl font-extrabold text-primary">+94%</strong>
          <p className="mt-2 text-sm text-text-2">≈ +17 pacientes/mês</p>
        </article>
      </div>
    </div>
    <div><Heading eyebrow="Plano de ação" title="Próximas prioridades"/>
      <div className={block}><CompactTable cols={["#","Ação","Impacto esperado","Urgência"]} rows={actions.map(a=>[a[0],<span key={a[0]} className="block min-w-[300px] whitespace-normal text-left">{a[1]}</span>,<span key={a[0]} className="block min-w-[240px] whitespace-normal text-left">{a[2]}</span>,a[3]])}/></div>
    </div>
  </>;
}
export function IsaborFaithfulReport() {
  const [active,setActive]=useState<TabKey>("geral");
  return <div className="space-y-5 pt-4">
    <SeptemberHero/>
    <nav aria-label="Seções do relatório da Dra. Isabor" className="sticky top-0 z-20 -mx-4 border-b border-border bg-[rgb(9_21_42/0.97)] px-4 sm:-mx-6 sm:px-6">
      <div className="grid grid-cols-4 gap-1 rounded-xl py-1.5">
        {tabs.map(([key,label])=><button key={key} type="button" onClick={()=>setActive(key)} aria-current={active===key?"page":undefined}
          className={"min-w-0 rounded-lg px-1.5 py-3 text-[10px] font-bold transition-colors sm:px-2 sm:text-xs "+(active===key?"bg-primary text-on-primary shadow-sm":"text-text-2 hover:bg-surface-2 hover:text-text")}>
          {label}
        </button>)}
      </div>
    </nav>
    <main className="space-y-10 pb-3">
      {active==="geral" ? <MonthlyFocus/> : null}
      {active==="comparativo" ? <Comparison/> : null}
      {active==="roi" ? <RoiAndChannels/> : null}
      {active==="diagnostico" ? <Diagnosis/> : null}
    </main>
  </div>;
}
