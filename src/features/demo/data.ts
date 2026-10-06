/**
 * Dados FICTÍCIOS de demonstração. Estruturas inspiradas nos dashboards atuais da
 * Look (funis de 2 a 4 etapas, canais, dimensões, indicadores avulsos), com
 * valores inventados. Nenhum nome de paciente/cliente final real.
 */
import { addDays, monthPeriod, weekPeriod, type Period } from "@/lib/dates/period";
import type { CommercialDataInput } from "@/features/commercial/schema";
import type { TrafficDataInput } from "@/features/traffic/schema";
import type { MediaPlanDataInput } from "@/features/media-plan/schema";
import type { Insight, ReportStatus } from "@/features/reports/schema";
import type { Client } from "@/features/clients/schema";

export interface DemoReport {
  type: "commercial" | "traffic" | "media_plan";
  period: Period;
  status: ReportStatus;
  commercial?: CommercialDataInput;
  traffic?: TrafficDataInput;
  mediaPlan?: MediaPlanDataInput;
  insights?: Array<Omit<Insight, "id" | "source">>;
  document?: { kind: "pdf" | "html_legacy"; title: string; allowDownload: boolean };
}

export interface DemoImportError {
  type: "commercial" | "traffic";
  fileName: string;
  format: "xlsx" | "csv";
  issues: Array<{ code: string; message: string; sheet?: string; row?: number; column?: string }>;
}

export interface DemoClient {
  client: Omit<Client, "id" | "createdAt" | "updatedAt" | "version" | "logo">;
  createdAt: string;
  reports: DemoReport[];
  importErrors?: DemoImportError[];
}

/** PRNG determinístico para variações semanais reproduzíveis. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function stage(key: string, label: string, order: number, value: number | null) {
  return { key, label, order, value };
}

// ————————————————————————————————————————————————————————————————————————
// Dra. Isabor Sant'Anna — Lead → Agendamento → Comparecimento
// ————————————————————————————————————————————————————————————————————————
const isaborMonths: Array<{
  m: number;
  leads: number;
  ag: number;
  comp: number;
  revenue: number;
  meta: number;
  google: number;
  ch: Record<"ig" | "gg" | "ind" | "doc" | "out", [number, number, number]>;
}> = [
  { m: 3, leads: 96, ag: 11, comp: 7, revenue: 2940, meta: 520, google: 480, ch: { ig: [58, 1, 420], gg: [21, 1, 400], ind: [6, 3, 1270], doc: [7, 1, 420], out: [4, 1, 430] } },
  { m: 4, leads: 108, ag: 12, comp: 8, revenue: 3380, meta: 560, google: 495.4, ch: { ig: [66, 1, 430], gg: [24, 1, 420], ind: [7, 4, 1680], doc: [6, 1, 425], out: [5, 1, 425] } },
  { m: 5, leads: 115, ag: 12, comp: 9, revenue: 3830, meta: 610.2, google: 510, ch: { ig: [72, 2, 850], gg: [25, 1, 425], ind: [7, 3, 1280], doc: [6, 2, 850], out: [5, 1, 425] } },
  { m: 6, leads: 77, ag: 10, comp: 7, revenue: 2975, meta: 590, google: 505.3, ch: { ig: [41, 1, 425], gg: [21, 1, 425], ind: [6, 3, 1275], doc: [5, 1, 425], out: [4, 1, 425] } },
  { m: 7, leads: 229, ag: 13, comp: 6, revenue: 2876, meta: 648.9, google: 512.4, ch: { ig: [192, 1, 430], gg: [22, 0, 0], ind: [5, 2, 986], doc: [6, 2, 860], out: [4, 1, 600] } },
  { m: 8, leads: 257, ag: 14, comp: 8, revenue: 3400, meta: 680.4, google: 527.77, ch: { ig: [217, 1, 450], gg: [26, 0, 0], ind: [4, 3, 1310], doc: [6, 2, 760], out: [4, 2, 880] } },
];

function isaborCommercial(): DemoReport[] {
  return isaborMonths.map((row) => {
    const period = monthPeriod(2026, row.m);
    const data: CommercialDataInput = {
      schemaVersion: 1,
      period,
      currency: "BRL",
      funnel: [stage("leads", "Leads", 1, row.leads), stage("agendamentos", "Agendamentos", 2, row.ag), stage("comparecimentos", "Comparecimentos", 3, row.comp)],
      financial: { revenue: row.revenue, mediaInvestment: round2(row.meta + row.google) },
      channels: [
        { key: "instagram", label: "Instagram", kind: "paid", leads: row.ch.ig[0], conversions: row.ch.ig[1], revenue: row.ch.ig[2], investment: row.meta },
        { key: "google-ads", label: "Google Ads", kind: "paid", leads: row.ch.gg[0], conversions: row.ch.gg[1], revenue: row.ch.gg[2], investment: row.google },
        { key: "indicacao", label: "Indicação", kind: "referral", leads: row.ch.ind[0], conversions: row.ch.ind[1], revenue: row.ch.ind[2], investment: null },
        { key: "doctoralia", label: "Doctoralia", kind: "marketplace", leads: row.ch.doc[0], conversions: row.ch.doc[1], revenue: row.ch.doc[2], investment: null },
        { key: "outros", label: "Outros", kind: "other", leads: row.ch.out[0], conversions: row.ch.out[1], revenue: row.ch.out[2], investment: null },
      ],
    };
    const insights: DemoReport["insights"] =
      row.m === 8
        ? [
            { type: "positive", title: "Receita cresceu no mês", description: "A receita subiu em relação a julho, puxada por indicações e pela Doctoralia." },
            { type: "attention", title: "Muitos leads, poucos agendamentos", description: "O Instagram trouxe a maior parte dos contatos, mas a taxa de agendamento ficou abaixo de 1%. Vale revisar o roteiro de atendimento no WhatsApp." },
            { type: "recommendation", title: "Reforçar o programa de indicação", description: "Indicação converte 3 de cada 4 contatos. Sugerimos um material simples para pacientes compartilharem após a consulta." },
          ]
        : row.m === 7
          ? [{ type: "neutral", title: "Mês de ajuste de campanha", description: "Nova campanha de captação no Instagram entrou no ar na segunda quinzena." }]
          : [];
    return { type: "commercial", period, status: "published", commercial: data, insights } satisfies DemoReport;
  });
}

function isaborTraffic(): DemoReport[] {
  const r = rng(11);
  const reports: DemoReport[] = [];
  const lastWeekStart = "2026-09-21";
  for (let i = 7; i >= 0; i--) {
    const period = weekPeriod(addDays(lastWeekStart, -7 * i));
    const isLatest = i === 0;
    const f = 0.82 + r() * 0.3;
    const metaInv = isLatest ? 144.68 : round2(138 * f);
    const metaImp = isLatest ? 5755 : Math.round(5400 * f * (0.9 + r() * 0.2));
    const googleInv = isLatest ? 175.82 : round2(168 * (0.85 + r() * 0.25));
    const googleImp = isLatest ? 6513 : Math.round(6100 * (0.85 + r() * 0.3));
    const traffic: TrafficDataInput = {
      schemaVersion: 1,
      period,
      currency: "BRL",
      campaigns: [
        {
          id: "meta-captacao-novo-site",
          platform: "meta_ads",
          name: "CAMP. 02 — Captação | Novo Site",
          investment: metaInv,
          impressions: metaImp,
          reach: isLatest ? 3860 : Math.round(metaImp * (0.62 + r() * 0.08)),
          linkClicks: isLatest ? 75 : Math.round(metaImp * (0.011 + r() * 0.004)),
          results: isLatest ? 11 : Math.round(8 + r() * 6),
          resultType: "whatsapp",
        },
        {
          id: "google-pesquisa-leads",
          platform: "google_ads",
          name: "Look Assessoria | Pesquisa | Leads",
          investment: googleInv,
          impressions: googleImp,
          clicks: isLatest ? 216 : Math.round(googleImp * (0.029 + r() * 0.008)),
          results: isLatest ? 9 : Math.round(5 + r() * 6),
          resultType: "lead",
        },
      ],
    };
    reports.push({
      type: "traffic",
      period,
      status: "published",
      traffic,
      insights: isLatest
        ? [
            { type: "positive", title: "Google Ads com CTR acima de 3%", description: "A campanha de pesquisa manteve boa taxa de cliques, sinal de anúncios alinhados ao que o paciente procura." },
            { type: "recommendation", title: "Testar novo criativo no Instagram", description: "O custo por conversa subiu levemente. Vamos testar um criativo em vídeo curto na próxima semana." },
          ]
        : [],
    });
  }
  return reports;
}

/** Plano de mídia de outubro: verba por plataforma, cronograma e metas (valores fictícios). */
function isaborMediaPlan(): DemoReport[] {
  const period = monthPeriod(2026, 10);
  return [
    {
      type: "media_plan",
      period,
      status: "published",
      mediaPlan: {
        schemaVersion: 1,
        period,
        items: [
          { id: "meta-captacao", platform: "meta_ads", name: "Captação | Consulta particular", objective: "Mensagens", audience: "Mulheres 30–60, raio de 8 km", format: "Reels e carrossel", start: "2026-10-01", end: "2026-10-31", budget: 750, resultType: "whatsapp", resultTarget: 110 },
          { id: "meta-remarketing", platform: "meta_ads", name: "Remarketing | Quem conversou e não agendou", objective: "Mensagens", audience: "Envolvidos nos últimos 30 dias", format: "Stories", start: "2026-10-12", end: "2026-10-31", budget: 150, resultType: "whatsapp", resultTarget: 25 },
          { id: "google-pesquisa", platform: "google_ads", name: "Pesquisa | Gastroenterologista", objective: "Leads", audience: "Buscas por gastro e endoscopia na região", format: "Anúncios de pesquisa", start: "2026-10-01", end: "2026-10-31", budget: 400, resultType: "lead", resultTarget: 30 },
        ],
        header: { title: "Estratégia de Mídia — Outubro", tagline: "Captação de consulta particular", summary: "Outubro concentra a verba no Meta Ads, que trouxe o melhor retorno em setembro, e mantém o Google Ads em observação.", tags: ["Meta Ads · WhatsApp", "Google Ads · Pesquisa"] },
        goals: [
          { key: "agendamentos", label: "Agendamentos", value: 25, format: "integer" },
          { key: "custo-por-agendamento", label: "Custo por agendamento", value: null, display: "R$ 45–55", format: "currency" },
        ],
        sections: [
          {
            key: "direcao",
            title: "Direção executiva",
            placement: "top",
            blocks: [
              { kind: "text", text: "A captação contínua no Instagram segue como prioridade; o remarketing entra na segunda quinzena para recuperar quem conversou e não agendou." },
              { kind: "callout", title: "Atendimento", text: "Responder as conversas em até 15 minutos no horário comercial." },
            ],
          },
        ],
      },
      insights: [{ type: "recommendation", title: "Responder em até 15 minutos", description: "A meta de agendamentos depende de resposta rápida às conversas que o Meta Ads vai gerar." }],
    },
  ];
}

// ————————————————————————————————————————————————————————————————————————
// Serenity — terapias; serviços, profissionais, novos x recorrentes
// ————————————————————————————————————————————————————————————————————————
const SERENITY_SERVICES = ["Massagem relaxante", "Drenagem linfática", "Massagem terapêutica", "Reflexologia"];
const SERENITY_PROS = ["Ana Paula", "Bruna", "Camila", "Débora", "Elaine", "Fabiana"];

function serenityCommercial(): DemoReport[] {
  const r = rng(29);
  const months = [
    { m: 1, leads: 41, ag: 14, comp: 10 },
    { m: 2, leads: 132, ag: 33, comp: 26 },
    { m: 3, leads: 349, ag: 58, comp: 47 },
    { m: 4, leads: 314, ag: 41, comp: 32 },
    { m: 5, leads: 203, ag: 57, comp: 50 },
    { m: 6, leads: 182, ag: 45, comp: 38 },
    { m: 7, leads: 170, ag: 48, comp: 41 },
    { m: 8, leads: 172, ag: 43, comp: 37 },
  ];
  return months.map((row) => {
    const period = monthPeriod(2026, row.m);
    const ticket = 318 + Math.round(r() * 40);
    const revenue = row.comp * ticket;
    const metaInv = round2(280 + r() * 330);
    const sitesInv = 220;
    const split = (total: number, weights: number[]) => {
      const sum = weights.reduce((a, b) => a + b, 0);
      const parts = weights.map((w) => Math.floor((total * w) / sum));
      parts[0] += total - parts.reduce((a, b) => a + b, 0);
      return parts;
    };
    const chLeads = split(row.leads, [55, 12, 10, 8, 4, 7, 2, 2]);
    const chConv = split(row.comp, [30, 10, 28, 14, 3, 9, 3, 3]);
    const chRev = chConv.map((c) => c * ticket);
    const svcQty = split(row.comp, [42, 26, 20, 12]);
    const proQty = split(row.comp, [24, 21, 18, 15, 12, 10]);
    const newClients = Math.round(row.comp * (0.55 + r() * 0.1));
    const data: CommercialDataInput = {
      schemaVersion: 1,
      period,
      funnel: [stage("leads", "Leads", 1, row.leads), stage("agendamentos", "Agendamentos", 2, row.ag), stage("comparecimentos", "Comparecimentos", 3, row.comp)],
      financial: { revenue, mediaInvestment: round2(metaInv + sitesInv), attributedRevenue: chRev[0] + chRev[5] },
      channels: [
        { key: "meta-ads", label: "Meta Ads", kind: "paid", leads: chLeads[0], conversions: chConv[0], revenue: chRev[0], investment: metaInv },
        { key: "google-organico", label: "Google (orgânico)", kind: "organic", leads: chLeads[1], conversions: chConv[1], revenue: chRev[1] },
        { key: "cliente-recorrente", label: "Cliente recorrente", kind: "recurring", leads: chLeads[2], conversions: chConv[2], revenue: chRev[2] },
        { key: "indicacao", label: "Indicação", kind: "referral", leads: chLeads[3], conversions: chConv[3], revenue: chRev[3] },
        { key: "panfletos", label: "Panfletos", kind: "offline", leads: chLeads[4], conversions: chConv[4], revenue: chRev[4] },
        { key: "sites-de-massagem", label: "Sites de massagem", kind: "paid", leads: chLeads[5], conversions: chConv[5], revenue: chRev[5], investment: sitesInv },
        { key: "parcerias", label: "Parcerias", kind: "partner", leads: chLeads[6], conversions: chConv[6], revenue: chRev[6] },
        { key: "site-proprio", label: "Site próprio", kind: "organic", leads: chLeads[7], conversions: chConv[7], revenue: chRev[7] },
      ],
      dimensions: [
        {
          key: "servicos",
          label: "Serviços",
          quantityLabel: "Atendimentos",
          rows: SERENITY_SERVICES.map((s, i) => ({ key: `svc-${i}`, label: s, quantity: svcQty[i], revenue: svcQty[i] * (ticket + (i === 1 ? 40 : i === 3 ? -30 : 0)) })),
        },
        {
          key: "profissionais",
          label: "Profissionais",
          quantityLabel: "Atendimentos",
          rows: SERENITY_PROS.map((p, i) => ({ key: `pro-${i}`, label: p, quantity: proQty[i], revenue: proQty[i] * ticket })),
        },
        {
          key: "tipo-de-cliente",
          label: "Novos x recorrentes",
          quantityLabel: "Clientes",
          rows: [
            { key: "novos", label: "Novos clientes", quantity: newClients },
            { key: "recorrentes", label: "Clientes recorrentes", quantity: row.comp - newClients },
          ],
        },
      ],
    };
    return {
      type: "commercial",
      period,
      // Agosto ainda em rascunho: demonstra o estado "Rascunho" no ADM.
      status: row.m === 8 ? "draft" : "published",
      commercial: data,
      insights:
        row.m >= 7
          ? [
              { type: "positive", title: "Taxa de comparecimento alta", description: "Mais de 85% dos agendamentos compareceram — o lembrete na véspera está funcionando." },
              { type: "attention", title: "Leads estáveis, conversão em queda", description: "O volume de contatos se manteve, mas a conversão final caiu. Acompanhar horários disponíveis na agenda." },
            ]
          : [],
    } satisfies DemoReport;
  });
}

// ————————————————————————————————————————————————————————————————————————
// Larplan — Lead → Contato → Proposta → Venda (ticket alto)
// ————————————————————————————————————————————————————————————————————————
function larplanCommercial(): DemoReport[] {
  const rows = [
    { m: 6, leads: 27, contato: 7, proposta: 3, vendas: 1, revenue: 26000, google: 812.3, meta: 0, ch: { gg: [1, 26000], rec: [0, 0], meta: [0, 0] } },
    { m: 7, leads: 53, contato: 11, proposta: 5, vendas: 4, revenue: 118400, google: 985.2, meta: 0, ch: { gg: [2, 61200], rec: [2, 57200], meta: [0, 0] } },
    // Agosto: etapas intermediárias não registradas no CRM (null ≠ 0).
    { m: 8, leads: 52, contato: null, proposta: null, vendas: 5, revenue: 139560.89, google: 1105.42, meta: 576.4, ch: { gg: [3, 50600], rec: [1, 61460.89], meta: [1, 27500] } },
  ];
  return rows.map((row) => {
    const period = monthPeriod(2026, row.m);
    const channels: CommercialDataInput["channels"] = [
      { key: "google-ads", label: "Google Ads", kind: "paid", leads: row.leads, conversions: row.ch.gg[0], revenue: row.ch.gg[1], investment: row.google },
      { key: "cliente-recorrente", label: "Cliente recorrente", kind: "recurring", conversions: row.ch.rec[0], revenue: row.ch.rec[1] },
    ];
    if (row.meta > 0) channels.push({ key: "meta-ads", label: "Meta Ads", kind: "paid", conversions: row.ch.meta[0], revenue: row.ch.meta[1], investment: row.meta });
    const data: CommercialDataInput = {
      schemaVersion: 1,
      period,
      funnel: [
        stage("leads", "Leads", 1, row.leads),
        stage("em-contato", "Em contato", 2, row.contato),
        stage("propostas", "Propostas enviadas", 3, row.proposta),
        stage("vendas", "Vendas", 4, row.vendas),
      ],
      financial: { revenue: row.revenue, mediaInvestment: round2(row.google + row.meta), sales: row.vendas, attributedRevenue: row.ch.gg[1] + row.ch.meta[1] },
      channels,
    };
    return {
      type: "commercial",
      period,
      status: "published",
      commercial: data,
      insights:
        row.m === 8
          ? [
              { type: "positive", title: "Meta Ads fechou a primeira venda", description: "No primeiro mês de campanha, o Meta Ads já trouxe uma venda." },
              { type: "attention", title: "Etapas do CRM sem registro", description: "Os contatos e propostas de agosto não foram lançados no CRM. Sem eles não conseguimos medir onde o funil perde força." },
            ]
          : [],
    } satisfies DemoReport;
  });
}

function larplanTraffic(): DemoReport[] {
  const r = rng(47);
  const reports: DemoReport[] = [];
  // Última semana entregue: 14 a 20/09 — a de 21 a 27/09 teve erro na importação.
  for (let i = 5; i >= 1; i--) {
    const period = weekPeriod(addDays("2026-09-21", -7 * i));
    const f = 0.85 + r() * 0.3;
    reports.push({
      type: "traffic",
      period,
      status: "published",
      traffic: {
        schemaVersion: 1,
        period,
        campaigns: [
          {
            id: "google-planejados-salvador",
            platform: "google_ads",
            name: "Pesquisa | Móveis planejados Salvador",
            investment: round2(245 * f),
            impressions: Math.round(4100 * f),
            clicks: Math.round(4100 * f * (0.045 + r() * 0.01)),
            results: Math.round(9 + r() * 6),
            resultType: "lead",
          },
          {
            id: "meta-ambientes",
            platform: "meta_ads",
            name: "Ambientes planejados | Cadastro",
            investment: round2(132 * f),
            impressions: Math.round(9800 * f),
            reach: Math.round(7200 * f),
            linkClicks: Math.round(96 * f),
            results: Math.round(3 + r() * 4),
            resultType: "form",
          },
        ],
      },
    });
  }
  return reports;
}

// ————————————————————————————————————————————————————————————————————————
// IL Distribuidora — só tráfego, resultados em conversas no WhatsApp
// ————————————————————————————————————————————————————————————————————————
function ilTraffic(): DemoReport[] {
  const r = rng(83);
  const reports: DemoReport[] = [];
  for (let i = 7; i >= 0; i--) {
    const period = weekPeriod(addDays("2026-09-21", -7 * i));
    const latest = i === 0;
    const v = () => 0.8 + r() * 0.35;
    const a = v();
    const b = v();
    const c = v();
    reports.push({
      type: "traffic",
      period,
      status: "published",
      traffic: {
        schemaVersion: 1,
        period,
        campaigns: [
          {
            id: "setembro-promocao",
            platform: "meta_ads",
            name: i <= 3 ? "SETEMBRO-26 | Itens em promoção" : "AGOSTO-26 | Itens em promoção",
            investment: latest ? 174.91 : round2(168 * a),
            impressions: latest ? 6220 : Math.round(6000 * a),
            reach: latest ? 4343 : Math.round(4200 * a),
            results: latest ? 37 : Math.round(33 * a * (0.85 + r() * 0.3)),
            resultType: "whatsapp",
          },
          {
            id: "lauro-de-freitas",
            platform: "meta_ads",
            name: "Lauro de Freitas - campanha",
            investment: latest ? 132.66 : round2(128 * b),
            impressions: latest ? 3361 : Math.round(3300 * b),
            reach: latest ? 2065 : Math.round(2000 * b),
            results: latest ? 16 : Math.round(15 * b * (0.8 + r() * 0.4)),
            resultType: "whatsapp",
          },
          {
            id: "cidades-com-unidade",
            platform: "meta_ads",
            name: "Cidades com Unidade IL | Captação de Leads | WhatsApp",
            investment: latest ? 193.42 : round2(186 * c),
            impressions: latest ? 26457 : Math.round(25000 * c),
            reach: latest ? 25087 : Math.round(23500 * c),
            results: latest ? 51 : Math.round(46 * c * (0.85 + r() * 0.3)),
            resultType: "whatsapp",
          },
        ],
      },
      insights: latest
        ? [
            { type: "positive", title: "Menor custo por conversa do mês", description: "A campanha das cidades com unidade entregou conversas a menos de R$ 4,00 cada." },
            { type: "attention", title: "Lauro de Freitas com custo mais alto", description: "O custo por conversa ficou acima de R$ 8,00. Vamos revisar o público e o raio de entrega." },
          ]
        : [],
    });
  }
  return reports;
}

// ————————————————————————————————————————————————————————————————————————
// Instituto Landim — funil de 2 etapas, dimensões e indicadores avulsos
// ————————————————————————————————————————————————————————————————————————
function landimCommercial(): DemoReport[] {
  const rows = [
    { m: 6, leads: 44, diretas: 4, pnorte: 5, psul: 3, revConv: 6200, revPart: 2400, google: 640.2, meta: 610.5, surg: 1, next: 3 },
    { m: 7, leads: 39, diretas: 2, pnorte: 5, psul: 2, revConv: 0, revPart: 1850, google: 1010.11, meta: 980.68, surg: 0, next: 2 },
  ];
  return rows.map((row) => {
    const period = monthPeriod(2026, row.m);
    const conv = row.diretas + row.pnorte + row.psul;
    const data: CommercialDataInput = {
      schemaVersion: 1,
      period,
      funnel: [stage("leads", "Leads", 1, row.leads), stage("conversoes", "Conversões", 2, conv)],
      financial: { revenue: row.revConv + row.revPart, mediaInvestment: round2(row.google + row.meta) },
      channels: [
        { key: "google-ads", label: "Google Ads", kind: "paid", leads: Math.round(row.leads * 0.78), conversions: Math.round(conv * 0.6), investment: row.google },
        { key: "meta-ads", label: "Meta Ads", kind: "paid", leads: Math.round(row.leads * 0.16), conversions: Math.round(conv * 0.2), investment: row.meta },
        { key: "indicacao", label: "Indicação", kind: "referral", leads: row.leads - Math.round(row.leads * 0.78) - Math.round(row.leads * 0.16), conversions: conv - Math.round(conv * 0.6) - Math.round(conv * 0.2) },
      ],
      dimensions: [
        {
          key: "tipo-de-conversao",
          label: "Tipo de conversão",
          quantityLabel: "Conversões",
          rows: [
            { key: "direta", label: "Atendimento direto", quantity: row.diretas },
            { key: "parceiro-norte", label: "Clínica parceira Norte", quantity: row.pnorte },
            { key: "parceiro-sul", label: "Clínica parceira Sul", quantity: row.psul },
          ],
        },
        {
          key: "tipo-de-atendimento",
          label: "Tipo de atendimento",
          rows: [
            { key: "convenio", label: "Convênio", leads: Math.round(row.leads * 0.74), revenue: row.revConv },
            { key: "particular", label: "Particular", leads: Math.round(row.leads * 0.16), revenue: row.revPart },
            { key: "nao-informado", label: "Não informado", leads: row.leads - Math.round(row.leads * 0.74) - Math.round(row.leads * 0.16), revenue: 0 },
          ],
        },
        {
          key: "procedimento",
          label: "Procedimento procurado",
          rows: [
            { key: "consulta", label: "Consulta", leads: Math.round(row.leads * 0.8) },
            { key: "fisioterapia", label: "Fisioterapia", leads: Math.round(row.leads * 0.09) },
            { key: "acupuntura", label: "Acupuntura", leads: Math.round(row.leads * 0.04) },
            { key: "nao-informado", label: "Não informado", leads: row.leads - Math.round(row.leads * 0.8) - Math.round(row.leads * 0.09) - Math.round(row.leads * 0.04) },
          ],
        },
      ],
      extraMetrics: [
        { key: "cirurgias", label: "Cirurgias geradas", value: row.surg, format: "integer", direction: "higherIsBetter" },
        { key: "marcacoes-proximo-mes", label: "Marcações para o mês seguinte", value: row.next, format: "integer", direction: "higherIsBetter" },
      ],
      context:
        row.m === 7
          ? { title: "Agenda reduzida em julho", description: "O médico responsável esteve fora por 16 dias. Parte dos leads foi direcionada às clínicas parceiras." }
          : null,
    };
    return {
      type: "commercial",
      period,
      status: "published",
      commercial: data,
      insights:
        row.m === 7
          ? [
              { type: "attention", title: "Receita concentrada em particular", description: "Com a agenda reduzida, os atendimentos de convênio não geraram receita no mês." },
              { type: "positive", title: "Parceiros sustentaram as conversões", description: "As clínicas parceiras absorveram a maior parte dos pacientes do período." },
            ]
          : [],
    } satisfies DemoReport;
  });
}

const commercialModule = (enabled: boolean) => ({ enabled, cadence: "monthly" as const, dueDay: 5, allowOriginalDownload: true });
const trafficModule = (enabled: boolean) => ({ enabled, cadence: "weekly" as const, dueDay: 1, allowOriginalDownload: false });
const mediaPlanModule = (enabled: boolean) => ({ enabled, cadence: "monthly" as const, dueDay: 1, allowOriginalDownload: false });

export function buildDemoClients(): DemoClient[] {
  return [
    {
      createdAt: "2026-03-02T12:00:00.000Z",
      client: {
        slug: "isabor",
        name: "Dra. Isabor Sant'Anna",
        shortName: "Dra. Isabor",
        greetingName: "Isabor",
        segment: "Gastroenterologia",
        status: "active",
        currency: "BRL",
        modules: { commercial: commercialModule(true), traffic: trafficModule(true), media_plan: mediaPlanModule(true) },
        dashboard: { roiMetric: "roas", highlightMetrics: [] },
        notes: "Relatório comercial consolidado pela secretária até o dia 3. Tráfego: Meta + Google.",
      },
      reports: [
        ...isaborCommercial(),
        ...isaborTraffic(),
        ...isaborMediaPlan(),
        {
          type: "commercial",
          period: monthPeriod(2026, 8),
          status: "published",
          document: { kind: "pdf", title: "Relatório comercial completo — agosto", allowDownload: true },
        },
        {
          type: "commercial",
          period: monthPeriod(2026, 7),
          status: "published",
          document: { kind: "html_legacy", title: "Dashboard comercial anterior (HTML)", allowDownload: false },
        },
      ],
    },
    {
      createdAt: "2026-01-10T12:00:00.000Z",
      client: {
        slug: "serenity",
        name: "Serenity Terapias",
        shortName: "Serenity",
        greetingName: "equipe Serenity",
        segment: "Terapias e bem-estar",
        status: "active",
        currency: "BRL",
        modules: { commercial: commercialModule(true), traffic: trafficModule(false), media_plan: mediaPlanModule(false) },
        dashboard: { roiMetric: "roiPercent", highlightMetrics: [] },
        notes: "Receita por terapeuta vem da planilha interna do espaço.",
      },
      reports: serenityCommercial(),
    },
    {
      createdAt: "2026-06-01T12:00:00.000Z",
      client: {
        slug: "larplan",
        name: "Larplan Móveis Planejados",
        shortName: "Larplan",
        greetingName: "Larplan",
        segment: "Móveis planejados",
        status: "active",
        currency: "BRL",
        modules: { commercial: commercialModule(true), traffic: trafficModule(true), media_plan: mediaPlanModule(false) },
        dashboard: { roiMetric: "roas", highlightMetrics: [] },
        notes: "Fonte: CRM da landing page. Etapas intermediárias nem sempre são registradas.",
      },
      reports: [...larplanCommercial(), ...larplanTraffic()],
      importErrors: [
        {
          type: "traffic",
          fileName: "larplan-trafego-21-27-set.xlsx",
          format: "xlsx",
          issues: [
            { code: "missing_column", message: "A coluna Investimento não foi encontrada na aba Campanhas.", sheet: "Campanhas", column: "Investimento" },
            { code: "invalid_period", message: "A data de início na linha 4 não é uma data válida.", sheet: "Campanhas", row: 4, column: "Início" },
          ],
        },
      ],
    },
    {
      createdAt: "2026-07-20T12:00:00.000Z",
      client: {
        slug: "il-distribuidora",
        name: "IL Distribuidora",
        shortName: "IL Distribuidora",
        greetingName: "IL Distribuidora",
        segment: "Distribuição",
        status: "active",
        currency: "BRL",
        modules: { commercial: commercialModule(false), traffic: trafficModule(true), media_plan: mediaPlanModule(false) },
        dashboard: { roiMetric: "roas", highlightMetrics: [] },
        notes: "Campanhas com objetivo de conversas no WhatsApp por unidade.",
      },
      reports: ilTraffic(),
    },
    {
      createdAt: "2026-06-05T12:00:00.000Z",
      client: {
        slug: "instituto-landim",
        name: "Instituto Landim",
        shortName: "Instituto Landim",
        greetingName: "Instituto Landim",
        segment: "Clínica médica",
        status: "active",
        currency: "BRL",
        modules: { commercial: commercialModule(true), traffic: trafficModule(false), media_plan: mediaPlanModule(false) },
        dashboard: { roiMetric: "roas", highlightMetrics: [] },
        notes: "Conversões podem acontecer em clínicas parceiras (indiretas).",
      },
      // Agosto ainda não enviado → aparece como pendente.
      reports: landimCommercial(),
    },
  ];
}
