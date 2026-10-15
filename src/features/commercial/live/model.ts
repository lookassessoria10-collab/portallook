import { CommercialDataSchema, type CommercialData } from "../schema";
import {
  isaborMonths,
  serenityMonths,
  serenityChannels,
  serenityServices,
  serenityTherapists,
} from "../reference-data";
import landim from "../landim/report.json";
import { monthPeriod } from "@/lib/dates/period";
import { normalizeText, slugify } from "@/lib/ids";
import type { Insight } from "@/features/reports/schema";

import { type CommercialProfile } from "./profiles";
export {
  commercialProfile,
  commercialProfiles,
  type CommercialProfile,
} from "./profiles";
export const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export type LiveMonth = {
  key: string;
  label: string;
  data: CommercialData;
  insights: Insight[];
  imported: boolean;
};
export type LiveCommercial = {
  profile: CommercialProfile;
  months: LiveMonth[];
  focus: LiveMonth;
  year: number;
};
export const referenceEnd = (profile: CommercialProfile) =>
  profile === "isabor" || profile === "serenity" ? "2026-09" : "2026-08";

const channel = (
  label: string,
  leads: number | null,
  conversions: number | null,
  revenue: number | null,
  investment: number | null,
  kind = "paid",
) => ({
  key: slugify(label),
  label,
  leads,
  conversions,
  revenue,
  investment,
  kind,
});
const metric = (label: string, value: number | null, format = "integer") => ({
  key: slugify(label),
  label,
  value,
  format,
});
function baseline(month: number, raw: Record<string, unknown>): LiveMonth {
  const data = CommercialDataSchema.parse({
    schemaVersion: 1,
    period: monthPeriod(2026, month),
    ...raw,
  });
  return {
    key: `2026-${String(month).padStart(2, "0")}`,
    label: monthNames[month - 1],
    data,
    insights: [],
    imported: false,
  };
}
const funnel = (...entries: Array<[string, number | null]>) =>
  entries.map(([label, value], order) => ({
    key: slugify(label),
    label,
    value,
    order,
  }));

export function referenceMonths(profile: CommercialProfile): LiveMonth[] {
  if (profile === "isabor")
    return isaborMonths.map((m, i) =>
      baseline(i + 5, {
        funnel: funnel(
          ["Leads", m.leads],
          ["Agendamentos", m.bookings],
          ["Comparecimentos", m.attended],
        ),
        financial: { revenue: m.revenue, mediaInvestment: m.spend },
        channels: [
          channel(
            "Instagram",
            m.metaLeads,
            m.metaAttended,
            m.metaRevenue,
            m.metaSpend,
          ),
          channel(
            "Google Ads",
            m.googleLeads,
            m.googleAttended,
            m.googleRevenue,
            m.googleSpend,
          ),
          channel(
            "Indicação",
            i === 4 ? 15 : null,
            i === 4 ? 9 : null,
            m.referralRevenue,
            0,
            "referral",
          ),
          channel(
            "Doctoralia",
            i === 4 ? 0 : null,
            i === 4 ? 0 : null,
            m.doctoraliaRevenue,
            0,
            "marketplace",
          ),
          channel("Outros", null, null, m.otherRevenue, null, "other"),
        ],
      }),
    );
  if (profile === "serenity")
    return serenityMonths.map((m, i) =>
      baseline(i + 1, {
        funnel: funnel(
          ["Leads", m.leads],
          ["Agendamentos", m.bookings],
          ["Comparecimentos", m.attended],
        ),
        financial: {
          revenue: m.revenue,
          mediaInvestment: m.metaSpend + m.sitesSpend,
          attributedRevenue: m.metaRevenue + m.sitesRevenue,
        },
        dimensions: [
          {
            key: "massagens",
            label: "Massagens",
            rows: serenityServices.map((d) => ({
              key: slugify(d.label),
              label: d.label,
              quantity: d.counts[i] ?? null,
            })),
          },
          {
            key: "terapeutas",
            label: "Terapeutas",
            rows: serenityTherapists.map((d) => ({
              key: slugify(d.label),
              label: d.label,
              quantity: d.counts[i] ?? null,
              note: d.status ?? null,
            })),
          },
        ],
        sectionNotes:
          i === 8
            ? [
                {
                  section: "Funil",
                  text: "Setembro: 41 leads registrados, com captura incompleta. A conversão calculada é distorcida por esse registro parcial.",
                },
              ]
            : [],
        days: m.days,
        customers: { new: m.newCustomers, returning: m.returning },
        channels: serenityChannels.map((c) =>
          channel(
            c.label,
            c.leads[i] ?? null,
            null,
            /ADS/.test(c.label)
              ? m.metaRevenue
              : /Sites de Massagem/.test(c.label)
                ? m.sitesRevenue
                : null,
            /ADS/.test(c.label)
              ? m.metaSpend
              : /Sites de Massagem/.test(c.label)
                ? m.sitesSpend
                : null,
            /ADS|Sites de Massagem/.test(c.label)
              ? "paid"
              : /Recorrente/.test(c.label)
                ? "recurring"
                : /Indicação/.test(c.label)
                  ? "referral"
                  : "organic",
          ),
        ),
      }),
    );
  if (profile === "landim")
    return landim.months.map((m, i) =>
      baseline(i + 7, {
        funnel: funnel(["Leads", m.leads], ["Conversões totais", m.convTotal]),
        financial: { revenue: m.receita, mediaInvestment: m.investTotal },
        customers: { new: m.diretas },
        channels: Object.entries(m.canal).map(([key, c]) => ({
          ...channel(
            key === "ind"
              ? "Indicação"
              : key === "google"
                ? "Google Ads"
                : "Meta Ads",
            c.leads,
            c.conv,
            c.rec,
            c.inv,
            key === "ind" ? "referral" : "paid",
          ),
          newCustomers: c.nov,
        })),
        extraMetrics: [
          metric("IAD", m.iad),
          metric("Clivale", m.clivale),
          metric("Conversões indiretas", m.indiretas),
          metric("Cirurgias geradas", m.cirurgias),
          metric("Marcações para mês seguinte", m.mesSeguinte),
          metric("Custo por lead pago", m.cplPago, "currency"),
          metric("Custo por conversão pago", m.custoConvPago, "currency"),
          metric("Novos pacientes pago", m.novosPacPago),
        ],
        dimensions: [
          {
            key: "perfil",
            label: "Perfil dos leads",
            rows: [
              ["Convênio", m.tipo.conv],
              ["Particular", m.tipo.part],
              ["Não informado", m.tipo.naoInf],
            ].map(([label, quantity]) => ({
              key: slugify(String(label)),
              label,
              quantity,
            })),
          },
          {
            key: "procedimentos",
            label: "Procedimentos",
            rows: [
              ["Consulta", m.proc.consulta],
              ["Fisioterapia", m.proc.fisio],
              ["Acupuntura", m.proc.acup],
            ].map(([label, quantity]) => ({
              key: slugify(String(label)),
              label,
              quantity,
            })),
          },
          {
            key: "receita-tipo",
            label: "Receita por tipo",
            rows: [
              { key: "convenio", label: "Convênio", revenue: m.receitaConv },
              {
                key: "particular",
                label: "Particular",
                revenue: m.receitaPart,
              },
            ],
          },
        ],
        tables: [
          {
            key: "cirurgias",
            title: "Cirurgias geradas",
            columns: ["Paciente", "Descrição", "Canal"],
            rows: m.cirurgiasList.map((s) => [
              s.n,
              s.s,
              s.canal === "ind" ? "Indicação" : "Google Ads",
            ]),
          },
          {
            key: "receita",
            title: "Receita detalhada",
            columns: ["Paciente", "Canal", "Tipo", "Valor"],
            rows: m.receitaRows.map((r) => [
              r.n,
              r.canal === "ind" ? "Indicação" : "Google Ads",
              r.tipo,
              String(r.v),
            ]),
          },
        ].filter((t) => t.rows.length),
        context: m.banner
          ? {
              title: m.banner.t,
              description: m.banner.d.replace(/<[^>]+>/g, ""),
            }
          : null,
      }),
    );
  const rows = [
    [27, 1, 26000, 916.45, 26000, 0, 7, 5],
    [53, 9, 137401.48, 1418.37, 15231.09, 0, 11, 2],
    [52, 5, 139560.89, 1681.82, 66151, 236.83, null, null],
  ];
  return rows.map(
    (
      [
        leads,
        sales,
        revenue,
        spend,
        googleRevenue,
        metaSpend,
        contact,
        proposal,
      ],
      i,
    ) =>
      baseline(i + 6, {
        funnel: funnel(
          ["Leads", leads],
          ["Em contato / Proposta", contact],
          ["Propostas enviadas", proposal],
          ["Vendas", sales],
        ),
        financial: { revenue, sales, mediaInvestment: spend },
        channels: [
          channel(
            "Google Ads",
            null,
            i === 2 ? 2 : null,
            googleRevenue,
            spend! - metaSpend!,
          ),
          channel(
            "Meta Ads",
            null,
            i === 2 ? 0 : null,
            i === 2 ? 0 : null,
            metaSpend,
          ),
          channel(
            "Cliente Recorrente",
            null,
            i === 2 ? 3 : null,
            i === 2 ? 73409.89 : null,
            0,
            "recurring",
          ),
        ],
      }),
  );
}

export const nkey = (s: string) => normalizeText(s).replace(/[^a-z0-9]/g, "");
export function stage(month: LiveMonth, names: string[]): number | null {
  const keys = names.map(nkey);
  return (
    month.data.funnel.find((s) => keys.includes(nkey(s.label)))?.value ?? null
  );
}
export const leads = (m: LiveMonth) =>
  stage(m, ["Leads", "Leads recebidos", "Leads gerados"]);
export const attended = (m: LiveMonth) =>
  stage(m, [
    "Comparecimentos",
    "Atendimentos",
    "Compareceram",
    "Vendas",
    "Vendas fechadas",
    "Conversões totais",
  ]);
export const bookings = (m: LiveMonth) =>
  stage(m, ["Agendamentos", "Agendados"]);
export const revenue = (m: LiveMonth) => m.data.financial?.revenue ?? null;
export const spend = (m: LiveMonth) =>
  m.data.financial?.mediaInvestment ?? null;
export function extra(m: LiveMonth, ...names: string[]) {
  return (
    m.data.extraMetrics.find((x) => names.map(nkey).includes(nkey(x.label)))
      ?.value ?? null
  );
}
export function divide(a: number | null, b: number | null): number | null {
  return a === null || b === null || b === 0 ? null : a / b;
}
/** Missing observations never become zero, including incomplete totals. */
export function sum(values: Array<number | null | undefined>): number | null {
  return !values.length || values.some((v) => v === null || v === undefined)
    ? null
    : values.reduce<number>((s, v) => s + v!, 0);
}

export function mergeCommercialMonths(
  profile: CommercialProfile,
  imports: LiveMonth[],
  selectedKey: string,
): LiveCommercial {
  const year = Number(selectedKey.slice(0, 4));
  const months = new Map(
    referenceMonths(profile)
      .filter((m) => m.key <= selectedKey && m.key.startsWith(String(year)))
      .map((m) => [m.key, m]),
  );
  // One entire normalized month replaces the reference. No stale sections or additive duplicates.
  for (const month of imports)
    if (month.key <= selectedKey && month.key.startsWith(String(year)))
      months.set(month.key, month);
  const ordered = [...months.values()].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  return {
    profile,
    year,
    months: ordered,
    focus:
      ordered.find((m) => m.key === selectedKey) ?? ordered[ordered.length - 1],
  };
}
