/**
 * Snapshot fiel aos relatórios HTML originais, publicados pela Look.
 *
 * Serenity: https://clientes.lookassessoria.com.br/serenity/dashboard-comercial.html
 * Isabor: https://clientes.lookassessoria.com.br/isabor/dashboard-comercial.html
 *
 * Nenhum valor aqui é somado a subtotais importados. A referência é estática até
 * setembro/2026; os adaptadores em live/model preservam a referência e
 * acrescentam os meses importados nos layouts específicos de cada cliente.
 * Os avisos de números incompletos/estimados são mantidos intencionalmente.
 */
export const monthsPt = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro"] as const;
export const monthsShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set"] as const;

export interface SerenityMonth {
  label: string; short: string; days: number; leads: number; bookings: number; attended: number;
  revenue: number; newCustomers: number; returning: number;
  metaSpend: number; metaRevenue: number; sitesSpend: number; sitesRevenue: number;
  roiNote: string;
}

const serenityRows: Array<[number, number, number, number, number, number, number, number, number, number, number, number, string]> = [
  [16,41,13,10,3595,7,3,418.73,251,220,795,0,"ADS ainda em fase de aprendizado"],
  [28,132,34,26,9034,18,8,284.11,839,220,1466,0,"Virada: ADS entra no positivo"],
  [31,349,57,47,16995,34,13,613.34,4597,220,1479,0,"Ambos os canais pagos em alta performance"],
  [30,314,45,32,11101,22,10,597.94,2213,220,2400,0,"Sites disparam · ADS perde eficiência vs Março"],
  [31,203,55,50,17430,34,16,489.25,600,220,450,0,"Crescimento veio de canais orgânicos"],
  [30,182,41,38,13210,25,13,602.03,750,220,1250,0,"Sites retomam · ADS em recuperação"],
  [31,170,47,41,12445,28,13,369.49,2045,220,1050,0,"Instagram recupera forte"],
  [31,172,43,37,12710,22,15,371.56,2150,220,2300,0,"Sites em pico histórico — 10,45x de retorno"],
  [30,41,36,36,10240,22,14,357.73,600,220,850,0,"Queda de performance — leads subestimados"],
];
export const serenityMonths: SerenityMonth[] = serenityRows.map((r,i)=>({
  label:monthsPt[i],short:monthsShort[i],days:r[0],leads:r[1],bookings:r[2],attended:r[3],
  revenue:r[4],newCustomers:r[5],returning:r[6],
  metaSpend:r[7],metaRevenue:r[8],sitesSpend:r[9],sitesRevenue:r[10],roiNote:r[12],
}));

export interface ReferenceChannel {
  label:string; leads:Array<number|null>; totalLeads:string; attended:string; conversion:string; revenue:number;
}
export const serenityChannels:ReferenceChannel[]=[
  {label:"ADS (Meta) Instagram + Facebook",leads:[14,62,254,232,117,95,95,95,null],totalLeads:"964+",attended:"42+",conversion:"4,4%",revenue:14045},
  {label:"Google",leads:[7,28,30,25,28,25,15,10,null],totalLeads:"168+",attended:"47+",conversion:"28,0%",revenue:16678},
  {label:"Cliente Recorrente VIP",leads:[5,14,15,12,16,14,14,17,null],totalLeads:"107+",attended:"97+",conversion:"90,7%",revenue:39061},
  {label:"Indicação",leads:[6,11,14,10,9,8,8,5,null],totalLeads:"71+",attended:"29+",conversion:"40,8%",revenue:9632},
  {label:"Panfleto China",leads:[null,null,null,null,14,15,10,15,null],totalLeads:"54+",attended:"22+",conversion:"40,7%",revenue:8800},
  {label:"Sites de Massagem",leads:[7,17,33,35,6,22,20,25,null],totalLeads:"165+",attended:"35+",conversion:"21,2%",revenue:12040},
  {label:"Sublocação",leads:[null,null,null,null,3,3,8,5,null],totalLeads:"19+",attended:"17+",conversion:"89,5%",revenue:3540},
  {label:"Site da Isa",leads:[null,null,3,null,null,null,null,null,null],totalLeads:"3",attended:"3",conversion:"100%",revenue:914},
];

export interface ReferenceDimension {
  label:string; counts:Array<number|null>; total:string; revenue:number; ticket:number; share?:string; status?:string; warning?:boolean;
}
export const serenityServices:ReferenceDimension[]=[
  {label:"Nuru",counts:[7,20,31,13,12,14,8,11,9],total:"125",revenue:47873,ticket:383,share:"46,1%"},
  {label:"Tailandesa",counts:[3,6,15,14,23,17,19,12,8],total:"117",revenue:34610,ticket:296,share:"33,4%"},
  {label:"Vivência",counts:[1,3,2,5,12,4,6,9,7],total:"49",revenue:18259,ticket:373,share:"17,6%"},
  {label:"Tântrica",counts:[1,6,6,null,null,null,null,null,null],total:"13",revenue:2778,ticket:214,share:"2,7%"},
];
export const serenityServiceMonthTotals=[12,35,54,32,47,35,33,32,24];

export const serenityTherapists:ReferenceDimension[]=[
  {label:"Lory",counts:[4,12,27,9,9,null,null,null,null],total:"61",revenue:18341,ticket:301,status:"Inativa"},
  {label:"Marina",counts:[null,null,null,8,19,23,19,13,9],total:"91",revenue:32030,ticket:352,status:"Destaque Set"},
  {label:"Sabrina",counts:[null,null,12,7,5,null,null,null,null],total:"24",revenue:7561,ticket:315,status:"Inativa"},
  {label:"Isa",counts:[4,7,7,3,null,null,null,5,9],total:"35",revenue:11223,ticket:321,status:"Ativa Set"},
  {label:"Júlia",counts:[2,4,null,null,11,3,1,null,null],total:"21",revenue:7184,ticket:342,status:"Inativa"},
  {label:"Ellen",counts:[2,11,null,null,null,null,null,null,null],total:"13",revenue:3621,ticket:278,status:"Inativa"},
  {label:"Bruna",counts:[null,null,5,2,null,7,8,15,6],total:"43",revenue:12934,ticket:301,status:"⚠️ Lançamento Set",warning:true},
  {label:"Estrella",counts:[null,null,2,2,null,null,null,null,null],total:"~4",revenue:1296,ticket:324,status:"Inativa"},
  {label:"Valentina",counts:[null,null,null,null,3,2,1,1,4],total:"11",revenue:3400,ticket:309,status:"Ativa Set"},
  {label:"Naomi",counts:[null,null,1,1,null,null,null,null,null],total:"~2",revenue:648,ticket:324,status:"Inativa"},
  {label:"Eva",counts:[null,null,null,null,2,null,null,null,null],total:"2",revenue:570,ticket:285,status:"Inativa"},
  {label:"Vanessa",counts:[null,null,null,null,1,2,null,null,null],total:"3",revenue:1200,ticket:400,status:"Inativa"},
  {label:"Bianca",counts:[null,1,null,null,null,null,null,null,null],total:"1",revenue:293,ticket:293,status:"Pontual"},
  {label:"Jade",counts:[null,null,null,null,null,null,1,null,1],total:"2",revenue:750,ticket:375,status:"Ativa"},
  {label:"Larissa Nova",counts:[null,null,null,null,null,null,10,null,2],total:"12",revenue:2090,ticket:174,status:"⚠️ Lançamento Set",warning:true},
  {label:"Alexia Nova",counts:[null,null,null,null,null,null,1,null,null],total:"1",revenue:450,ticket:450,status:"Inativa"},
  {label:"Mel Nova",counts:[null,null,null,null,null,null,1,null,null],total:"1",revenue:120,ticket:120,status:"Inativa"},
  {label:"Angel Nova",counts:[null,null,null,null,null,null,null,2,5],total:"7",revenue:2750,ticket:393,status:"Ativa Set"},
  {label:"Renata Nova",counts:[null,null,null,null,null,null,null,null,1],total:"1",revenue:300,ticket:300,status:"Nova (Set)"},
];

export const serenityInsights=[
  {tag:"⚠️ Dado crítico",title:"Leads subestimados (41*) — análise parcialmente comprometida",description:"Setembro registra 41 leads, abaixo do histórico recente (~175/mês). A captura foi incompleta, distorcendo a taxa de conversão de 87,8%*. Prioridade: revisar o registro de leads no CRM."},
  {tag:"⚠️ Atenção",title:"Ticket médio cai para R$ 284 — erro de lançamento a corrigir",description:"Bruna (6 atendimentos) e Larissa (2) apresentam ticket de R$ 100 em setembro, com valor suspeito. É necessário confirmar os valores e corrigir o sistema antes de conclusões definitivas."},
  {tag:"Recorrência",title:"Recorrentes respondem por 51% da receita — R$ 5.240",description:"14 recorrentes geraram R$ 5.240 em setembro. A base de clientes recorrentes sustenta parte relevante da receita do mês."},
  {tag:"Terapeutas",title:"Marina lidera com 9 atendimentos — Angel cresce para 5",description:"Isa também realizou 9 atendimentos (R$ 3.200). Angel passou de 2 para 5; Valentina chegou a 4 atendimentos."},
  {tag:"Serviços",title:"Vivência consolida posição com 7 atendimentos",description:"Em setembro: Nuru 9, Tailandesa 8, Vivência 7. Tântrica sem registro desde abril."},
  {tag:"ROI",title:"ADS cai para +67,8% — menor ROI desde janeiro",description:"Meta gerou R$ 600 com investimento de R$ 357,73; Sites R$ 850 com R$ 220. A atribuição do mês pode estar afetada pela captura incompleta dos leads."},
  {tag:"Novo",title:"Renata estreia com 1 atendimento e R$ 300",description:"Renata se junta ao quadro em setembro; planejamento de outubro prevê ampliar as agendas de Renata, Angel e Valentina."},
  {tag:"Contexto",title:"Setembro foi um mês de transição — dados a serem revisados",description:"Receita de R$ 10.240 (−19,4% frente a agosto), 36 comparecimentos (−2,7%) e um cancelamento de R$ 300 já corrigido. Manter a ressalva para os registros de leads e tickets."},
];
export const serenityPlans=[
  {priority:"01 · Dados",title:"Corrigir lançamentos e fechar os dados de setembro",description:"Confirmar tickets de Bruna e Larissa (R$ 100) e recuperar leads que ficaram sem registro no CRM/WhatsApp."},
  {priority:"02 · Leads",title:"Garantir o registro completo de todos os leads",description:"Revisar formulários, CRM, Instagram e WhatsApp. Meta de outubro: 150+ leads corretamente registrados."},
  {priority:"03 · Crescimento",title:"Escalar Angel, Renata e Valentina",description:"Metas: Angel 8+, Valentina 6+ e Renata 3+ atendimentos; reduzir concentração da agenda."},
  {priority:"04 · Recorrência",title:"Ativar a base de setembro para reagendamento",description:"Contatar clientes atendidos entre 15 e 20 de outubro e buscar 18+ recorrências."},
];

export interface IsaborMonth {
  label:string; short:string; leads:number; bookings:number; attended:number; revenue:number; spend:number;
  metaSpend:number; googleSpend:number; metaRevenue:number; googleRevenue:number; referralRevenue:number; doctoraliaRevenue:number; otherRevenue:number;
  metaLeads:number; googleLeads:number; metaAttended:number; googleAttended:number;
}
const isaborRows:Array<[number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number]> = [
  [115,13,10,4150,1409.56,117.48,1292.08,0,800,2900,450,0,30,69,0,2,0],
  [77,13,7,2950,1155.02,214.73,941.29,450,0,2500,0,0,33,29,1,0,0],
  [116,12,12,5150,1184.67,401.02,783.65,450,0,3400,850,450,74,26,1,0,0],
  [257,14,8,3400,1208.17,770.45,437.72,450,0,2500,450,0,217,26,1,0,0],
  [130,23,18,7750,1044.45,697.90,346.55,3550,450,3750,0,0,89,26,8,1,0],
];
export const isaborMonths:IsaborMonth[]=isaborRows.map((r,i)=>({
  label:monthsPt[i+4],short:monthsShort[i+4],leads:r[0],bookings:r[1],attended:r[2],revenue:r[3],spend:r[4],
  metaSpend:r[5],googleSpend:r[6],metaRevenue:r[7],googleRevenue:r[8],referralRevenue:r[9],
  doctoraliaRevenue:r[10],otherRevenue:r[11],metaLeads:r[12],googleLeads:r[13],metaAttended:r[14],googleAttended:r[15],
}));

export const isaborInsights=[
  {tag:"Conversão",title:"Setembro foi o melhor mês do ano",description:"18 comparecimentos e R$ 7.750 com 130 leads. A conversão Lead → Paciente avançou de 3,1% para 13,8%."},
  {tag:"Instagram",title:"Instagram virou um canal de receita",description:"8 pacientes, R$ 3.550 (45,8% do mês) e retorno 5,09x, mesmo com verba menor que a de agosto."},
  {tag:"Indicação",title:"O canal mais eficiente continua sendo indicação",description:"60% de conversão, 50% dos pacientes e 48,4% da receita de setembro. Acumulado: R$ 15.050 (64,3% da receita total)."},
  {tag:"Google Ads",title:"Primeira receita desde maio",description:"Um paciente, retorno de 1,30x em setembro. Acumulado continua em 0,33x: R$ 3.801 investidos e R$ 1.250 em receita."},
  {tag:"Perdas",title:"Principais objeções no atendimento",description:"Valor da consulta, procura por planos de saúde, solicitações específicas de exames (como colonoscopia) e pacientes fora da região."},
  {tag:"Doctoralia",title:"Canal sem leads em setembro",description:"Gerou R$ 1.750 no acumulado. Verificar atividade do perfil e disponibilidade da agenda."},
];
export const isaborPlans=[
  {priority:"1 · Alta",title:"Qualificar o lead antes do contato comercial",description:"Triagem sobre valor da consulta, plano de saúde e procura por exames. Preservar a conversão de 13,8%."},
  {priority:"2 · Alta",title:"Escalar Meta Ads com cautela",description:"Manter segmentação e criativos que renderam 5,09x; ampliar verba progressivamente e acompanhar conversão."},
  {priority:"3 · Alta",title:"Confirmar agendamentos de outubro e acompanhar leads parados",description:"3 pacientes com atendimento futuro e 112 leads de setembro não convertidos."},
  {priority:"4 · Média",title:"Fortalecer o programa de indicação",description:"Ativar rotina de pedidos de indicação aos pacientes satisfeitos; canal responde por 64,3% da receita."},
  {priority:"5 · Média",title:"Google Ads em observação",description:"Otimizar palavras-chave para consulta particular e validar continuidade do retorno de setembro."},
];
