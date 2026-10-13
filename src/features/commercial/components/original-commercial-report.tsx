"use client";
import { createContext, useContext, useState } from "react";

import { serenityMonths, serenityChannels, serenityServices, serenityTherapists, serenityInsights, serenityPlans, isaborMonths, isaborInsights, isaborPlans, monthsShort } from "@/features/commercial/reference-data";

const money = (n: number, cents = false) => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL",minimumFractionDigits:cents?2:0,maximumFractionDigits:cents?2:0}).format(n);
const pct = (n:number, digits = 1) => new Intl.NumberFormat("pt-BR",{style:"percent",minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
const integer = (n:number) => new Intl.NumberFormat("pt-BR").format(n);
const box = "rounded-2xl border border-border bg-surface p-5";
const td = "whitespace-nowrap border-t border-border px-3 py-2 text-right text-xs tabular-nums text-text-2";
const th = "whitespace-nowrap px-3 py-2 text-right text-xs font-bold text-text-2";

function Stats({items}:{items:Array<[string,string,string?]>}){
 return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{items.map(([name,value,sub])=><article key={name} className={box}><p className="text-[11px] font-bold uppercase tracking-wider text-text-3">{name}</p><p className="mt-2 text-2xl font-extrabold text-text">{value}</p>{sub&&<p className="mt-1 text-xs text-text-2">{sub}</p>}</article>)}</div>;
}
function Tabular({title,headers,rows}:{title:string;headers:string[];rows:Array<Array<string|number|null>>}){
 return <section className={box}><h3 className="mb-4 text-base font-bold text-text">{title}</h3><div className="overflow-x-auto rounded-xl border border-border"><table className="min-w-full"><thead className="bg-surface-2"><tr>{headers.map((x,i)=><th key={i} className={th}>{x}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j} className={td}>{v??"—"}</td>)}</tr>)}</tbody></table></div></section>;
}
function Bars({title,items}:{title:string;items:Array<{label:string;value:number;caption:string}>}){const top=Math.max(1,...items.map(x=>x.value));return <div className={box}><h3 className="mb-4 text-base font-bold text-text">{title}</h3><div className="space-y-3">{items.map(x=><div key={x.label}><div className="mb-1 flex justify-between gap-2 text-xs text-text-2"><span>{x.label}</span><strong>{x.caption}</strong></div><div className="h-2.5 rounded-full bg-surface-3"><div className="h-2.5 rounded-full bg-primary" style={{width:String(Math.max(2,x.value/top*100))+"%"}}/></div></div>)}</div></div>}
const ActiveSection = createContext("visao-geral");
function Section({id,title,children}:{id:string;title:string;children:React.ReactNode}){
 const active = useContext(ActiveSection);
 return <section id={id} hidden={active!==id} className="space-y-5 pt-4"><h2 className="text-xl font-bold text-text">{title}</h2>{children}</section>;
}
function Notes({insights,plans}:{insights:Array<{tag:string;title:string;description:string}>;plans:Array<{priority:string;title:string;description:string}>}){
 return <><div className="grid gap-4 md:grid-cols-2">{insights.map((x,i)=><article key={i} className={box}><p className="mb-2 text-xs font-bold uppercase text-primary">{x.tag}</p><h3 className="font-semibold text-text">{x.title}</h3><p className="mt-2 text-sm leading-relaxed text-text-2">{x.description}</p></article>)}</div><h2 className="text-lg font-bold text-text">Plano de ação — Outubro</h2><div className="grid gap-4 md:grid-cols-2">{plans.map((x,i)=><article key={i} className={box}><p className="text-xs font-bold text-primary">{x.priority}</p><h3 className="mt-1 font-semibold text-text">{x.title}</h3><p className="mt-2 text-sm text-text-2">{x.description}</p></article>)}</div></>;
}
function ReturnCard({name,invest,rev}:{name:string;invest:number;rev:number}){
 return <div className={box}><p className="text-xs font-bold uppercase text-text-3">{name}</p><p className="my-3 text-3xl font-extrabold text-positive">+{pct(rev/invest-1,0)}</p><p className="text-sm text-text-2">Investido: {money(invest)}<br/>Receita: {money(rev)}<br/>Por R$ 1: {money(rev/invest,true)}</p></div>;
}
function Serenity(){
 const months=serenityMonths;
 return <div className="space-y-10">
 <Section id="visao-geral" title="Setembro em foco — vs Agosto · Dados corrigidos · Leads subestimados (41*)">
 <div className="rounded-2xl bg-[var(--focus-gradient)] p-6 text-white"><div className="mb-3 font-serif text-xl">Setembro 2026</div><div className="grid grid-cols-2 gap-5 sm:grid-cols-4">{[["Receita","R$10,2k","▼ −19,4%"],["Leads","41*","▼ −76,2%*"],["Agendamentos","36","▼ −16,3%"],["Comparecimentos","36","▼ −2,7%"],["Ticket médio","R$284","▼ −17,4%"],["Conversão","87,8%*","Leads incompletos"],["Novos clientes","22","0%"],["Recorrentes","14","▼ −6,7%"]].map(([a,b,c])=><div key={a}><p className="text-xl font-extrabold">{b}</p><p className="text-[10px] uppercase text-white/70">{a}</p><p className="mt-1 text-xs text-white/75">{c}</p></div>)}</div></div>
 <h3 className="text-lg font-bold text-text">Acumulado do período · Janeiro a setembro de 2026</h3>
 <Stats items={[["Receita total","R$106,8k","Jan 15 – Set 30"],["Total de leads","1.604*","Setembro incompleto"],["Comparecimentos","317"],["Taxa de conversão","19,8%*"],["Ticket médio","R$337"],["Clientes recorrentes","105"],["Novos clientes","212"],["Investimento em Ads","R$6,1k"]]}/>
 <div className="grid gap-4 lg:grid-cols-2"><Bars title="Evolução da receita" items={months.map(m=>({label:m.label,value:m.revenue,caption:money(m.revenue)}))}/><Bars title="Leads captados" items={months.map(m=>({label:m.label,value:m.leads,caption:integer(m.leads)}))}/></div>
 <Tabular title="Detalhamento mensal" headers={["Mês","Dias","Leads","Agendamentos","Comparecimentos","Conversão","Receita","Ticket médio","Novos","Recorrentes"]} rows={[...months.map((m,i)=>[m.label,m.days,i===8?"41*":m.leads,m.bookings,m.attended,i===8?"87,8%*":pct(m.attended/m.leads),money(m.revenue),money(m.revenue/m.attended),m.newCustomers,m.returning]),["Total","~258","1.604*","371","317","19,8%*",money(106760),money(337),212,105]]}/>
 <Tabular title="Variação mês a mês" headers={["Indicador",...monthsShort]} rows={[["Receita",...months.map(m=>money(m.revenue))],["Crescimento",...months.map((m,i)=>i?pct(m.revenue/months[i-1].revenue-1):"—")],["Leads",...months.map(m=>m.leads)],["Comparecimentos",...months.map(m=>m.attended)],["Ticket médio",...months.map(m=>money(m.revenue/m.attended))]]}/>
 </Section>
 <Section id="canais" title="Canais & ROI — Janeiro a setembro">
 <Tabular title="Conversão e receita por canal" headers={["Canal",...monthsShort,"Leads","Comparec.","Conversão","Receita","%"]} rows={serenityChannels.map(x=>[x.label,...x.leads.map(x=>x??"—"),x.totalLeads,x.attended,x.conversion,money(x.revenue),pct(x.revenue/104710)])}/>
 <p className="text-sm text-text-2">Original: 1.602* leads classificados por canal versus 1.604* no funil. Os dados de setembro são parciais.</p>
 <h3 className="text-lg font-bold text-text">ROI geral acumulado (jan–set)</h3><p className="text-sm text-text-2">Apenas Meta Ads e Sites de Massagem, sem incluir canais orgânicos, recorrência e indicação.</p>
 <div className="grid gap-4 md:grid-cols-3"><ReturnCard name="ROI geral" invest={6084.18} rev={26085}/><ReturnCard name="ROI ADS (Meta)" invest={4104.18} rev={14045}/><ReturnCard name="ROI Sites de Massagem" invest={1980} rev={12040}/></div>
 <Tabular title="ROI por canal — detalhamento mensal" headers={["Canal","Mês","Investimento","Receita","Líquido","ROI","Retorno / R$ 1"]} rows={["ADS Meta","Sites de Massagem"].flatMap(label=>months.map(m=>{const inv=label==="ADS Meta"?m.metaSpend:m.sitesSpend,rev=label==="ADS Meta"?m.metaRevenue:m.sitesRevenue;return [label,m.label,money(inv,true),money(rev),money(rev-inv),pct(rev/inv-1),money(rev/inv,true)];}))}/>
 <Tabular title="ROI mês a mês (canais pagos)" headers={["Mês","Investimento","Receita","ROI","Observação"]} rows={months.map(m=>[m.label,money(m.metaSpend+m.sitesSpend,true),money(m.metaRevenue+m.sitesRevenue),pct((m.metaRevenue+m.sitesRevenue)/(m.metaSpend+m.sitesSpend)-1),m.roiNote])}/>
 </Section>
 <Section id="servicos" title="Massagens mais vendidas"><Tabular title="Detalhamento por tipo" headers={["Massagem",...monthsShort,"Total","Receita","Ticket","%"]} rows={serenityServices.map(x=>[x.label,...x.counts,x.total,money(x.revenue),money(x.ticket),x.share??"—"])}/></Section>
 <Section id="terapeutas" title="Desempenho por terapeuta"><Tabular title="Detalhamento por profissional" headers={["Terapeuta",...monthsShort,"Total","Receita","Ticket","Status"]} rows={serenityTherapists.map(x=>[x.label,...x.counts,x.total,money(x.revenue),money(x.ticket),x.status??"—"])}/><p className="text-sm text-text-2">Valentina realizou 4 atendimentos em setembro. Verificar lançamentos de Bruna e Larissa com ticket suspeito.</p></Section>
 <Section id="insights" title="Diagnóstico e plano de ação"><Notes insights={serenityInsights} plans={serenityPlans}/><Tabular title="Comparativo agosto vs setembro" headers={["Indicador","Agosto","Setembro","Variação","Leitura"]} rows={[["Leads","172","41*","−76,2%*","Dados incompletos no CRM"],["Agendamentos","43","36","−16,3%","Queda real"],["Comparecimentos","37","36","−2,7%","Presença de 100% (36/36)"],["Receita","R$12.710","R$10.240","−19,4%","Ticket comprimido por lançamentos"],["Ticket médio","R$344","R$284 ⚠️","−17,4%","Revisar tickets de R$100"],["Taxa de comparecimento","86,0%","100%","+14,0pp","Todos os agendados compareceram"],["Retorno pago","R$7,52/R$1","R$2,51/R$1","−66,6%","ADS em baixa; leads incompletos"]]}/></Section>
 </div>;
}
function Isabor(){
 const months=isaborMonths,m=months[4];
 return <div className="space-y-10">
 <Section id="visao-geral" title="01 — Indicadores consolidados · Maio a setembro"><Stats items={[["Leads","695"],["Agendamentos","75","10,8% dos leads"],["Comparecimentos","55"],["Receita total","R$23.400"],["Ticket médio","R$425"],["Investimento","R$6.002"]]}/>
 <h3 className="text-lg font-bold text-text">02 — Funil e conversão · Setembro</h3><Stats items={[["Leads","130"],["Agendamentos","23","17,7% dos leads"],["Comparecimentos","18","78,3% agendados"],["Lead → paciente","13,8%"]]}/>
 <p className="text-sm text-text-2">Mesmo com menos leads do que agosto (257 → 130), setembro registrou 18 comparecimentos contra 8 e a melhor conversão do ano.</p>
 <h3 className="text-lg font-bold text-text">03 — Investimento e receita por canal · Setembro</h3>
 <Tabular title="Investimento em mídia" headers={["Canal","Investimento"]} rows={[["Meta Ads",money(m.metaSpend,true)],["Google Ads",money(m.googleSpend,true)],["Total",money(m.spend,true)]]}/>
 <Tabular title="Receita por canal" headers={["Canal","Comparec.","Receita"]} rows={[["Indicação",9,money(3750)],["Instagram",8,money(3550)],["Google",1,money(450)],["Doctoralia",0,money(0)],["Total",18,money(7750)]]}/>
 <h3 className="text-lg font-bold text-text">04 — Distribuição de leads</h3><Tabular title="Volume e conversão — Setembro" headers={["Canal","Leads","Comparec.","Conversão"]} rows={[["Instagram",89,8,"9,0%"],["Google",26,1,"3,8%"],["Indicação",15,9,"60%"],["Doctoralia",0,0,"—"],["Outros",0,0,"—"]]}/>
 </Section>
 <Section id="comparativo" title="Comparativo mensal 2026">
 <div className="grid gap-4 lg:grid-cols-2"><Bars title="Receita mensal" items={months.map(m=>({label:m.label,value:m.revenue,caption:money(m.revenue)}))}/><Bars title="Volume de leads" items={months.map(m=>({label:m.label,value:m.leads,caption:integer(m.leads)}))}/></div>
 <Tabular title="Evolução dos indicadores — Maio a Setembro" headers={["Indicador",...months.map(x=>x.short),"Acumulado"]} rows={[["Leads",...months.map(x=>x.leads),695],["Agendamentos",...months.map(x=>x.bookings),75],["Comparecimentos",...months.map(x=>x.attended),55],["Conversão lead → paciente",...months.map(x=>pct(x.attended/x.leads)),"7,9%"],["Receita",...months.map(x=>money(x.revenue)),money(23400)],["Ticket médio",...months.map(x=>money(x.revenue/x.attended,true)),money(23400/55,true)],["Investimento",...months.map(x=>money(x.spend,true)),money(6001.87,true)],["Meta Ads",...months.map(x=>money(x.metaSpend,true)),money(2201.58,true)],["Google Ads",...months.map(x=>money(x.googleSpend,true)),money(3801.29,true)],["ROI geral",...months.map(x=>(x.revenue/x.spend).toFixed(2).replace(".",",")+"x"),"3,90x"],["ROI Google",...months.map(x=>(x.googleRevenue/x.googleSpend).toFixed(2).replace(".",",")+"x"),"0,33x"],["ROI Instagram",...months.map(x=>(x.metaRevenue/x.metaSpend).toFixed(2).replace(".",",")+"x"),"2,23x"]]}/>
 </Section>
 <Section id="canais" title="ROI & Canais · Maio a Setembro"><Stats items={[["Retorno geral","3,90x","R$23.400 ÷ R$6.001,87"],["Google Ads","0,33x","Receita R$1.250"],["Meta Ads","2,23x","Receita R$4.900"]]}/>
 <p className="text-sm text-text-2">Retorno geral: receita total ÷ investimento. Retorno de cada canal: somente receita atribuída ao respectivo canal ÷ investimento.</p>
 <Tabular title="Retorno mensal — geral, Google e Instagram" headers={["Mês","Invest. total","Receita total","Retorno","Google inv.","Google receita","Google retorno","Meta inv.","Meta receita","Meta retorno"]} rows={[...months.map(x=>[x.label,money(x.spend,true),money(x.revenue),(x.revenue/x.spend).toFixed(2)+"x",money(x.googleSpend,true),money(x.googleRevenue),(x.googleRevenue/x.googleSpend).toFixed(2)+"x",money(x.metaSpend,true),money(x.metaRevenue),(x.metaRevenue/x.metaSpend).toFixed(2)+"x"]),["Acumulado",money(6001.87,true),money(23400),"3,90x",money(3801.29,true),money(1250),"0,33x",money(2201.58,true),money(4900),"2,23x"]]}/>
 <div className="grid gap-3 md:grid-cols-2">{months.flatMap(x=>[["Google Ads",x.googleSpend,x.googleRevenue,x.googleLeads,x.googleAttended],["Instagram (Meta)",x.metaSpend,x.metaRevenue,x.metaLeads,x.metaAttended]].map(([name,inv,rev,leads,att])=><article key={x.label+"-"+name} className={box}><p className="text-xs font-bold text-text-2">{name} · {x.label}</p><strong className="mt-2 block text-2xl text-positive">{(Number(rev)/Number(inv)).toFixed(2)}x</strong><p className="mt-2 text-sm text-text-2">{money(Number(inv),true)} investidos · {leads} leads · {att} comparecimentos · {money(Number(rev))} em receita</p></article>))}</div>
 </Section>
 <Section id="diagnostico" title="Diagnóstico consolidado — Setembro"><Notes insights={isaborInsights} plans={isaborPlans}/><h3 className="text-lg font-bold text-text">Agendamentos já marcados para Outubro</h3><Tabular title="Oportunidades abertas" headers={["Origem","Data agendada","Situação"]} rows={[["Indicação","02/10/2026","Aguardando atendimento"],["Indicação","02/10/2026","Aguardando atendimento"],["Google","28/10/2026","Aguardando atendimento"]]}/><Stats items={[["Receita potencial","≈ R$1.290","3 consultas × R$430"],["Potencial com 257 leads","≈ R$15.070","~35 pacientes"],["Crescimento possível","+94%","≈ +17 pacientes por mês"]]}/></Section>
 </div>;
}
export function OriginalCommercialReport({client}:{client:"serenity"|"isabor"}) {
 const [active,setActive]=useState("visao-geral");
 const tabs=client==="serenity"?[["visao-geral","Visão geral"],["canais","Canais & ROI"],["servicos","Serviços"],["terapeutas","Terapeutas"],["insights","Insights"]]:[["visao-geral","Visão geral"],["comparativo","Comparativo mensal"],["canais","ROI & Canais"],["diagnostico","Diagnóstico"]];
 return <ActiveSection.Provider value={active}><div className="space-y-6"><nav aria-label="Seções do relatório comercial" className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-border bg-[rgb(9_21_42/0.97)] px-4 sm:-mx-6 sm:px-6">{tabs.map(([id,label])=><button type="button" key={id} onClick={()=>setActive(id)} aria-current={active===id?"page":undefined} className={"shrink-0 border-b-2 px-3 py-4 text-xs font-bold uppercase "+(active===id?"border-primary text-primary":"border-transparent text-text-2 hover:text-primary")}>{label}</button>)}</nav>{client==="serenity"?<Serenity/>:<Isabor/>}</div></ActiveSection.Provider>;
}
