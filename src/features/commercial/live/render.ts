import {
  serenityChannels,
  serenityServices,
  serenityTherapists,
} from "../reference-data";
import type { CommercialData } from "../schema";
import {
  attended,
  bookings,
  divide,
  extra,
  leads,
  monthNames,
  nkey,
  revenue,
  spend,
  stage,
  sum,
  type LiveCommercial,
  type LiveMonth,
} from "./model";

export type ChartFormat = "integer" | "currency" | "percent" | "multiplier";
export type LiveChart = {
  id: string;
  format: ChartFormat;
  config: Record<string, unknown>;
};
export type LiveTab = {
  id: string;
  label: string;
  html: string;
  charts: LiveChart[];
};
export const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const fmt = (
  v: number | null | undefined,
  type: ChartFormat = "integer",
  digits?: number,
) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : type === "currency"
      ? "R$ " +
        v.toLocaleString("pt-BR", {
          minimumFractionDigits: digits ?? 0,
          maximumFractionDigits: digits ?? 0,
        })
      : type === "percent"
        ? v.toLocaleString("pt-BR", {
            minimumFractionDigits: digits ?? 1,
            maximumFractionDigits: digits ?? 1,
          }) + "%"
        : type === "multiplier"
          ? v.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) + "×"
          : v.toLocaleString("pt-BR", { maximumFractionDigits: digits ?? 0 });
const percent = (a: number | null, b: number | null) => {
  const ratio = divide(a, b);
  return ratio === null ? null : ratio * 100;
};
const palette = [
  "var(--dash-1)",
  "var(--dash-2)",
  "var(--dash-3)",
  "var(--dash-4)",
  "var(--dash-5)",
  "var(--dash-6)",
  "var(--dash-7)",
  "var(--dash-8)",
];
const unique = (items: string[]) => [...new Set(items)];
const total = (s: LiveCommercial, f: (m: LiveMonth) => number | null) =>
  sum(s.months.map(f));
const ticket = (m: LiveMonth) =>
  m.data.financial?.averageTicket ??
  divide(revenue(m), m.data.financial?.sales ?? attended(m));
const paid = (m: LiveMonth) => m.data.channels.filter((c) => c.kind === "paid");
const channelNames = (s: LiveCommercial) =>
  unique(s.months.flatMap((m) => m.data.channels.map((c) => c.label)));
function chan(m: LiveMonth, label: string) {
  return m.data.channels.find((c) => nkey(c.label) === nkey(label));
}
function dimension(m: LiveMonth, ...names: string[]) {
  return m.data.dimensions.find((d) =>
    names.map(nkey).some((n) => nkey(d.label).includes(n)),
  );
}
function quantity(
  m: LiveMonth,
  names: string[],
  row: string,
  field: "quantity" | "revenue" = "quantity",
) {
  return (
    dimension(m, ...names)?.rows.find((r) => nkey(r.label) === nkey(row))?.[
      field
    ] ?? null
  );
}
const finalRate = (m: LiveMonth) => percent(attended(m), leads(m));
const cpl = (m: LiveMonth) =>
  extra(m, "Custo por lead pago") ??
  divide(spend(m), sum(paid(m).map((c) => c.leads)));
const newPatients = (m: LiveMonth) =>
  m.data.customers?.new ?? stage(m, ["Conversões diretas", "Novos pacientes"]);
function note(m: LiveMonth, section: string) {
  return m.data.sectionNotes
    .filter((n) => nkey(n.section).includes(nkey(section)))
    .map((n) => `<p class="nota">${escapeHtml(n.text)}</p>`)
    .join("");
}

function aggregateReference(
  s: LiveCommercial,
  sourceTotal: number | null,
  f: (m: LiveMonth) => number | null,
): number | null {
  const historical = s.months.filter((m) => m.key <= "2026-09");
  const intact =
    s.year === 2026 &&
    historical.length === 9 &&
    historical.every((m) => !m.imported);
  return intact && sourceTotal !== null
    ? sum([sourceTotal, ...s.months.filter((m) => m.key > "2026-09").map(f)])
    : total(s, f);
}
function channelTotal(
  s: LiveCommercial,
  label: string,
  field: "leads" | "conversions" | "revenue" | "investment",
) {
  const ref = serenityChannels.find((c) => nkey(c.label) === nkey(label));
  const known = ref
    ? field === "revenue"
      ? ref.revenue
      : field === "leads"
        ? Number.parseInt(ref.totalLeads)
        : field === "conversions"
          ? Number.parseInt(ref.attended)
          : null
    : null;
  return s.profile === "serenity"
    ? aggregateReference(s, known, (m) => chan(m, label)?.[field] ?? null)
    : total(s, (m) => chan(m, label)?.[field] ?? null);
}
function dimensionTotal(
  s: LiveCommercial,
  name: string,
  label: string,
  field: "quantity" | "revenue" = "quantity",
) {
  const refs = /Massagens|Serviços/.test(name)
    ? serenityServices
    : serenityTherapists;
  const ref = refs.find((d) => nkey(d.label) === nkey(label));
  return aggregateReference(
    s,
    ref
      ? field === "quantity"
        ? Number.parseInt(ref.total)
        : ref.revenue
      : null,
    (m) => quantity(m, [name], label, field),
  );
}

class Renderer {
  charts: LiveChart[] = [];
  index = 0;
  constructor(readonly report: LiveCommercial) {}
  get landim() {
    return this.report.profile === "landim";
  }
  title(s: string) {
    return `<h2 class="${this.landim ? "section-title" : "sec-title"}">${escapeHtml(s)}</h2>`;
  }
  card(title: string, html: string, caption?: string) {
    return `<article class="${this.landim ? "chart-box" : "card"}"><h3 class="${this.landim ? "section-title" : ""}">${escapeHtml(title)}</h3>${caption ? `<p class="desc">${escapeHtml(caption)}</p>` : ""}${html}</article>`;
  }
  grid(html: string, count = 2) {
    return `<div class="${this.landim ? "grid2" : `g${count}`}">${html}</div>`;
  }
  section(title: string, html: string) {
    return `<section class="sec">${this.title(title)}${html}</section>`;
  }
  kpis(items: Array<[string, number | null | string, ChartFormat?, string?]>) {
    return `<div class="${this.landim ? "kpi-grid" : "g4"}">${items.map(([label, value, format, sub]) => `<article class="kpi"><div class="${this.landim ? "label" : "k-lbl"}">${escapeHtml(label)}</div><div class="${this.landim ? "value" : "k-val"}">${escapeHtml(typeof value === "string" ? value : fmt(value, format))}</div>${sub ? `<p class="${this.landim ? "foot" : "k-sub"}">${escapeHtml(sub)}</p>` : ""}</article>`).join("")}</div>`;
  }
  table(
    title: string,
    columns: string[],
    rows: Array<Array<string | number | null>>,
  ) {
    return this.section(
      title,
      `<div class="${this.landim ? "table-wrap" : "comp-wrap"}"><table><thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v, i) => `<td${i ? ' class="num"' : ""}>${escapeHtml(v ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
    );
  }
  chart(
    title: string,
    series: Array<{
      label: string;
      data: Array<number | null>;
      type?: string;
      stack?: string;
    }>,
    format: ChartFormat = "integer",
    type = "bar",
    labels = this.report.months.map((m) => m.label),
    horizontal = false,
  ) {
    const id = `live-${this.report.profile}-${++this.index}`;
    const stacked = series.some((s) => s.stack);
    this.charts.push({
      id,
      format,
      config: {
        type,
        data: {
          labels,
          datasets: series.map((s, i) => ({
            ...s,
            backgroundColor:
              type === "doughnut" || horizontal
                ? labels.map((_, j) => palette[j % palette.length])
                : palette[i % palette.length],
            borderColor: palette[i % palette.length],
            borderRadius: type === "bar" ? 5 : undefined,
            tension: 0.3,
            fill: false,
            borderDash: type === "line" && i ? [6, 3] : undefined,
            yAxisID:
              format === "currency" && s.label.includes("CPL")
                ? "y1"
                : undefined,
          })),
        },
        options: {
          indexAxis: horizontal ? "y" : "x",
          responsive: true,
          maintainAspectRatio: false,
          cutout: type === "doughnut" ? "65%" : undefined,
          plugins: { legend: { position: "bottom" } },
          scales:
            type === "doughnut"
              ? undefined
              : {
                  x: { stacked, grid: { display: false } },
                  y: {
                    stacked,
                    beginAtZero: true,
                    grid: { color: "var(--chart-grid)" },
                  },
                  ...(series.some((s) => s.label.includes("CPL"))
                    ? {
                        y1: {
                          position: "right",
                          beginAtZero: true,
                          grid: { display: false },
                        },
                      }
                    : {}),
                },
        },
      },
    });
    return this.card(
      title,
      `<div class="${this.landim ? "chart-container" : "ch-wrap tall"}"${horizontal ? ` style="height:${Math.max(300, labels.length * 30)}px"` : ""}><canvas id="${id}" role="img" aria-label="${escapeHtml(title)}"></canvas></div>`,
    );
  }
  trend(
    title: string,
    f: (m: LiveMonth) => number | null,
    format: ChartFormat = "integer",
    type = "bar",
  ) {
    return this.chart(
      title,
      [{ label: title, data: this.report.months.map(f) }],
      format,
      type,
    );
  }
  channelChart(
    title: string,
    field: "leads" | "revenue" | "investment" | "conversions",
    focus = false,
    type = "bar",
  ) {
    const names = channelNames(this.report).filter(
        (n) =>
          field !== "investment" ||
          this.report.months.some((m) => chan(m, n)?.kind === "paid"),
      ),
      m = this.report.focus;
    return focus
      ? this.chart(
          title,
          [
            {
              label: title,
              data: names.map((n) => chan(m, n)?.[field] ?? null),
            },
          ],
          field === "revenue" || field === "investment"
            ? "currency"
            : "integer",
          type,
          names,
        )
      : this.chart(
          title,
          names.map((n) => ({
            label: n,
            data: this.report.months.map((m) => chan(m, n)?.[field] ?? null),
          })),
          field === "revenue" || field === "investment"
            ? "currency"
            : "integer",
        );
  }
  importedTables(
    filter: (t: CommercialData["tables"][number]) => boolean = () => true,
    all = false,
  ) {
    return (all ? this.report.months : [this.report.focus])
      .map((m) =>
        m.data.tables
          .filter(filter)
          .map((t) =>
            this.table(
              `${t.title}${all ? " · " + m.label : ""}`,
              t.columns,
              t.rows,
            ),
          )
          .join(""),
      )
      .join("");
  }
  insights() {
    const m = this.report.focus;
    return (
      this.section(
        `Diagnóstico · ${m.label}`,
        m.insights.length
          ? m.insights
              .map(
                (i) =>
                  `<article class="${this.landim ? "insight" : "diag-item"}"><div><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.description)}</p></div></article>`,
              )
              .join("")
          : '<p class="nota">Nenhuma análise informada para este mês.</p>',
      ) +
      this.importedTables() +
      m.data.sectionNotes
        .map(
          (n) =>
            `<p class="nota"><strong>${escapeHtml(n.section)}:</strong> ${escapeHtml(n.text)}</p>`,
        )
        .join("") +
      (m.data.extraMetrics.length
        ? this.table(
            "Indicadores informados",
            ["Indicador", "Valor"],
            m.data.extraMetrics.map((e) => [
              e.label,
              fmt(
                e.format === "percent" && e.value !== null
                  ? e.value * 100
                  : e.value,
                e.format === "currency"
                  ? "currency"
                  : e.format === "percent"
                    ? "percent"
                    : e.format === "multiplier"
                      ? "multiplier"
                      : "integer",
              ),
            ]),
          )
        : "") +
      m.data.comparisonNotes
        .map(
          (n) =>
            `<p class="nota"><strong>${escapeHtml(n.label)}:</strong> ${escapeHtml(n.text)}</p>`,
        )
        .join("")
    );
  }
  tab(id: string, label: string, build: () => string): LiveTab {
    this.charts = [];
    const html = build();
    return { id, label, html, charts: this.charts };
  }
}

function annual(r: Renderer) {
  const s = r.report;
  type Metric = [
    string,
    (m: LiveMonth) => number | null,
    ChartFormat,
    (() => number | null)?,
  ];
  const metric = (
    name: string,
    f: (m: LiveMonth) => number | null,
    format: ChartFormat = "integer",
    acc?: () => number | null,
  ): Metric => [name, f, format, acc];
  const rate = (
    name: string,
    a: (m: LiveMonth) => number | null,
    b: (m: LiveMonth) => number | null,
  ) =>
    metric(
      name,
      (m) => percent(a(m), b(m)),
      "percent",
      () => percent(total(s, a), total(s, b)),
    );
  const ratio = (
    name: string,
    a: (m: LiveMonth) => number | null,
    b: (m: LiveMonth) => number | null,
    format: ChartFormat = "multiplier",
  ) =>
    metric(
      name,
      (m) => divide(a(m), b(m)),
      format,
      () => divide(total(s, a), total(s, b)),
    );
  const ch =
    (name: string, field: "revenue" | "investment") => (m: LiveMonth) =>
      chan(m, name)?.[field] ?? null;
  let metrics: Metric[];
  if (s.profile === "landim")
    metrics = [
      metric("Leads recebidos", leads),
      metric("Conversões totais", attended),
      rate("Taxa de conversão", attended, leads),
      metric("Conversões diretas (pacientes)", newPatients),
      metric("Conversões indiretas", (m) => extra(m, "Conversões indiretas")),
      metric("— IAD", (m) => extra(m, "IAD")),
      metric("— Clivale", (m) => extra(m, "Clivale")),
      metric("Marcações p/ mês seguinte", (m) =>
        extra(m, "Marcações para mês seguinte"),
      ),
      metric("Receita gerada (R$)", revenue, "currency"),
      metric(
        "— Convênio (R$)",
        (m) => quantity(m, ["Receita por tipo"], "Convênio", "revenue"),
        "currency",
      ),
      metric(
        "— Particular (R$)",
        (m) => quantity(m, ["Receita por tipo"], "Particular", "revenue"),
        "currency",
      ),
      metric("Cirurgias geradas", (m) => extra(m, "Cirurgias geradas")),
      metric("Investimento total (R$)", spend, "currency"),
      metric("— Google Ads (R$)", ch("Google Ads", "investment"), "currency"),
      metric("— Meta Ads (R$)", ch("Meta Ads", "investment"), "currency"),
      ratio(
        "Custo por lead — pago (R$)",
        spend,
        (m) => sum(paid(m).map((c) => c.leads)),
        "currency",
      ),
      ratio(
        "Custo por conversão — pago (R$)",
        spend,
        (m) => sum(paid(m).map((c) => c.conversions)),
        "currency",
      ),
      metric(
        "Novos pacientes — pago",
        (m) =>
          extra(m, "Novos pacientes pago") ??
          sum(paid(m).map((c) => c.newCustomers)),
      ),
    ];
  else if (s.profile === "larplan") {
    const contact = (m: LiveMonth) =>
        stage(m, ["Em contato", "Em contato / Proposta"]),
      proposal = (m: LiveMonth) => stage(m, ["Propostas enviadas"]);
    metrics = [
      metric("Leads gerados", leads),
      metric("Em contato / Proposta", contact),
      metric("Propostas enviadas", proposal),
      metric("Vendas fechadas", attended),
      rate("Lead → Contato/Proposta", contact, leads),
      rate("Lead → Venda", attended, leads),
      rate("Proposta → Venda", attended, proposal),
      metric("Receita", revenue, "currency"),
      ratio("Ticket médio", revenue, attended, "currency"),
      metric(
        "Investimento Google Ads",
        ch("Google Ads", "investment"),
        "currency",
      ),
      metric(
        "Investimento Meta Ads Novo",
        ch("Meta Ads", "investment"),
        "currency",
      ),
      ratio("ROI Geral", revenue, spend),
      ratio(
        "ROI Google Ads (direto)",
        ch("Google Ads", "revenue"),
        ch("Google Ads", "investment"),
      ),
      ratio(
        "ROI Meta Ads (direto)",
        ch("Meta Ads", "revenue"),
        ch("Meta Ads", "investment"),
      ),
      ratio("Custo por lead", spend, leads, "currency"),
      ratio("Custo por venda", spend, attended, "currency"),
    ];
  } else {
    metrics = [
      metric("Leads", leads),
      metric("Agendamentos", bookings),
      metric("Comparecimentos", attended),
      rate("Conversão lead → paciente", attended, leads),
      metric("Receita", revenue, "currency"),
      ratio("Ticket médio", revenue, attended, "currency"),
      metric("Investimento", spend, "currency"),
    ];
    if (s.profile === "isabor")
      metrics.push(
        metric("Meta Ads", ch("Instagram", "investment"), "currency"),
        metric("Google Ads", ch("Google Ads", "investment"), "currency"),
        ratio("ROI geral", revenue, spend),
        ratio(
          "ROI Google",
          ch("Google Ads", "revenue"),
          ch("Google Ads", "investment"),
        ),
        ratio(
          "ROI Instagram",
          ch("Instagram", "revenue"),
          ch("Instagram", "investment"),
        ),
        ...["Indicação", "Google Ads", "Instagram", "Doctoralia", "Outros"].map(
          (label) =>
            metric("Receita " + label, ch(label, "revenue"), "currency"),
        ),
      );
  }
  if (s.profile === "landim") {
    const prev = s.months.at(-2);
    return (
      r.table(
        "Resultado mês a mês",
        ["Indicador", ...s.months.map((m) => m.label), "Variação"],
        metrics.map(([name, f, type]) => [
          name,
          ...s.months.map((m) =>
            fmt(f(m), type, type === "currency" ? 2 : undefined),
          ),
          fmt(
            prev
              ? percent(
                  f(s.focus) === null || f(prev) === null
                    ? null
                    : f(s.focus)! - f(prev)!,
                  f(prev),
                )
              : null,
            "percent",
          ),
        ]),
      ) +
      (s.focus.data.context
        ? `<p class="nota">${escapeHtml(s.focus.data.context.description)}</p>`
        : "")
    );
  }
  const monthMap = new Map(s.months.map((m) => [Number(m.key.slice(5, 7)), m]));
  return r.table(
    `Evolução de todos os indicadores por mês · ${s.year}`,
    ["Indicador", ...monthNames.map((n) => n.slice(0, 3)), "Acumulado"],
    metrics.map(([name, f, type, acc]) => [
      name,
      ...monthNames.map((_, i) => {
        const m = monthMap.get(i + 1);
        return m ? fmt(f(m), type, type === "currency" ? 2 : undefined) : "—";
      }),
      fmt(acc ? acc() : total(s, f), type, type === "currency" ? 2 : undefined),
    ]),
  );
}
function overview(r: Renderer) {
  const s = r.report,
    m = s.focus;
  let html = r.section(
    `Indicadores consolidados · ${s.year}`,
    r.kpis([
      ["Leads", total(s, leads)],
      ["Agendamentos", total(s, bookings)],
      [
        s.profile === "larplan" ? "Vendas" : "Comparecimentos",
        total(s, attended),
      ],
      ["Receita total", total(s, revenue), "currency"],
      [
        "Ticket médio",
        divide(total(s, revenue), total(s, attended)),
        "currency",
      ],
      ["Investimento", total(s, spend), "currency"],
    ]),
  );
  html +=
    r.section(
      `Funil e conversão do mês · ${m.label}`,
      r.grid(
        r.card(
          "Funil de conversão",
          m.data.funnel
            .map(
              (f, i) =>
                `<div class="f-bar b${i === 0 ? "1" : "2"}" style="width:${100 - i * 15}%"><span>${escapeHtml(f.label)}</span><strong>${fmt(f.value)}</strong></div>`,
            )
            .join(""),
        ) +
          r.card(
            "Taxas de conversão",
            m.data.funnel
              .map((f, i) =>
                i
                  ? `<p class="nota">${escapeHtml(m.data.funnel[i - 1].label)} → ${escapeHtml(f.label)}: <strong>${fmt(percent(f.value, m.data.funnel[i - 1].value), "percent")}</strong></p>`
                  : "",
              )
              .join("") +
              `<p class="nota">Lead → ${s.profile === "larplan" ? "Venda" : "Paciente"}: ${fmt(finalRate(m), "percent")}</p>`,
          ),
      ),
    ) + note(m, "Funil");
  html += r.section(
    `Investimento e retorno por canal · ${m.label}`,
    r.grid(
      r.channelChart("Investimento em mídia", "investment", true, "doughnut") +
        r.channelChart("Receita por canal", "revenue", true, "doughnut"),
    ) +
      r.table(
        "Receita por canal",
        ["Canal", "Conversões", "Receita", "Investimento"],
        m.data.channels.map((c) => [
          c.label,
          fmt(c.conversions),
          fmt(c.revenue, "currency", 2),
          fmt(c.investment, "currency", 2),
        ]),
      ) +
      note(m, "Receita"),
  );
  html +=
    r.section(
      `Volume de leads por canal · ${m.label}`,
      r.grid(
        r.channelChart("Leads por canal", "leads", true, "doughnut") +
          r.table(
            "Volume e conversão",
            ["Canal", "Leads", "Conversões", "Conversão"],
            m.data.channels.map((c) => [
              c.label,
              fmt(c.leads),
              fmt(c.conversions),
              fmt(percent(c.conversions, c.leads), "percent"),
            ]),
          ),
      ),
    ) + note(m, "Leads");
  return html;
}
function roi(r: Renderer) {
  const s = r.report,
    m = s.focus,
    names = channelNames(s);
  let html = r.section(
    `Retorno sobre investimento · acumulado ${s.year}`,
    r.kpis(
      s.profile === "isabor"
        ? [
            [
              "Retorno geral",
              divide(total(s, revenue), total(s, spend)),
              "multiplier",
            ],
            ...["Google Ads", "Instagram"].map(
              (label) =>
                [
                  label,
                  divide(
                    channelTotal(s, label, "revenue"),
                    channelTotal(s, label, "investment"),
                  ),
                  "multiplier",
                ] as [string, number | null, ChartFormat],
            ),
          ]
        : [
            [
              "Retorno geral",
              divide(total(s, revenue), total(s, spend)),
              "multiplier",
            ],
            ["Receita total", total(s, revenue), "currency"],
            ["Investimento total", total(s, spend), "currency"],
          ],
    ),
  );
  html += r.chart(
    "ROI Geral vs. canais pagos",
    [
      {
        label: "ROI Geral",
        data: s.months.map((m) => divide(revenue(m), spend(m))),
      },
      ...names
        .filter((n) => s.months.some((m) => chan(m, n)?.kind === "paid"))
        .map((n) => ({
          label: n,
          data: s.months.map((m) =>
            divide(chan(m, n)?.revenue ?? null, chan(m, n)?.investment ?? null),
          ),
        })),
    ],
    "multiplier",
    "line",
  );
  html += r.table(
    "ROI por canal e mês",
    [
      "Mês",
      "Canal",
      "Investimento",
      "Receita atribuída",
      "Retorno",
      "Leads",
      "Conversões",
    ],
    s.months.flatMap((m) =>
      m.data.channels.map((c) => [
        m.label,
        c.label,
        fmt(c.investment, "currency", 2),
        fmt(c.revenue, "currency", 2),
        fmt(divide(c.revenue, c.investment), "multiplier"),
        fmt(c.leads),
        fmt(c.conversions),
      ]),
    ),
  );
  html +=
    r.section(
      `Performance por canal · ${m.label}`,
      r.grid(
        (s.profile === "isabor" ? s.months : [m])
          .flatMap((month) =>
            month.data.channels
              .filter((c) => c.kind === "paid")
              .map((c) =>
                r.card(
                  `${c.label} · ${month.label}`,
                  r.kpis([
                    ["Retorno", divide(c.revenue, c.investment), "multiplier"],
                    ["Receita", c.revenue, "currency"],
                    ["Investimento", c.investment, "currency"],
                    ["Conversões", c.conversions],
                  ]),
                ),
              ),
          )
          .join(""),
        3,
      ),
    ) + note(m, "ROI");
  return html;
}
function larplanTabs(r: Renderer): LiveTab[] {
  const s = r.report,
    m = s.focus;
  return [
    r.tab(
      "visao",
      "Visão Geral",
      () =>
        r.section(
          `Resultado consolidado do ano · ${s.year}`,
          r.kpis([
            ["Leads", total(s, leads)],
            ["Vendas", total(s, attended)],
            ["Receita total", total(s, revenue), "currency"],
            [
              "Ticket médio",
              divide(total(s, revenue), total(s, attended)),
              "currency",
            ],
            ["Investimento", total(s, spend), "currency"],
          ]),
        ) +
        r.section(
          "Funil e conversão do mês",
          r.grid(
            r.card(
              "Funil de conversão",
              r.kpis([
                ["Leads recebidos", leads(m)],
                ["Vendas fechadas", attended(m)],
                ["Conversão final", finalRate(m), "percent"],
              ]) + note(m, "Funil"),
            ) +
              r.trend(
                "Conv. Lead→Venda — evolução mensal",
                finalRate,
                "percent",
              ),
          ),
        ) +
        r.section(
          `Distribuição por canal · ${m.label}`,
          r.grid(
            r.channelChart(
              "Receita por canal de aquisição",
              "revenue",
              true,
              "doughnut",
            ) +
              r.table(
                "Detalhamento por canal",
                ["Canal", "Vendas", "Receita", "%"],
                m.data.channels.map((c) => [
                  c.label,
                  fmt(c.conversions),
                  fmt(c.revenue, "currency", 2),
                  fmt(percent(c.revenue, revenue(m)), "percent"),
                ]),
              ),
          ),
        ),
    ),
    r.tab(
      "comp",
      "Comparativo Mensal",
      () =>
        annual(r) +
        r.grid(
          r.chart(
            "Receita e Investimento",
            [
              { label: "Receita", data: s.months.map(revenue) },
              {
                label: "Investimento",
                type: "line",
                data: s.months.map(spend),
              },
            ],
            "currency",
          ) +
            r.chart("Funil — Volumes", [
              { label: "Leads", data: s.months.map(leads) },
              { label: "Vendas", data: s.months.map(attended) },
            ]),
        ),
    ),
    r.tab(
      "roi",
      "ROI & Canais",
      () =>
        r.trend(
          "ROI acumulado — evolução",
          (m) => divide(revenue(m), spend(m)),
          "multiplier",
        ) + roi(r),
    ),
    r.tab(
      "diag",
      "Diagnóstico",
      () =>
        r.insights() +
        r.section(
          "Simulação de crescimento",
          r.kpis([
            ["Cenário atual", finalRate(m), "percent"],
            [
              "Meta de conversão",
              extra(m, "Meta de conversão") === null
                ? null
                : extra(m, "Meta de conversão")! * 100,
              "percent",
            ],
            [
              "Receita projetada",
              extra(m, "Meta de conversão") === null ||
              leads(m) === null ||
              ticket(m) === null
                ? null
                : Math.round(leads(m)! * extra(m, "Meta de conversão")!) *
                  ticket(m)!,
              "currency",
            ],
          ]),
        ),
    ),
  ];
}
function landimTabs(r: Renderer): LiveTab[] {
  const s = r.report,
    m = s.focus;
  const stack = (label: string, f: (m: LiveMonth) => number | null) => ({
    label,
    data: s.months.map(f),
    stack: "funil",
  });
  return [
    r.tab(
      "evolucao",
      "Evolução",
      () =>
        (m.data.context
          ? `<div class="banner"><div><strong>${escapeHtml(m.data.context.title)}</strong><p>${escapeHtml(m.data.context.description)}</p></div></div>`
          : "") +
        r.section(
          `Mês mais recente · ${m.label}/${s.year}`,
          r.kpis([
            ["Leads recebidos", leads(m)],
            ["Conversões totais", attended(m)],
            ["Novos pacientes", newPatients(m)],
            ["Receita gerada", revenue(m), "currency"],
            ["Cirurgias geradas", extra(m, "Cirurgias geradas")],
            ["Investimento mídia", spend(m), "currency"],
            ["Custo por lead pago", cpl(m), "currency"],
            [
              "Marcações p/ mês seguinte",
              extra(m, "Marcações para mês seguinte"),
            ],
          ]),
        ) +
        r.grid(
          r.chart("Composição do funil por mês", [
            stack("Diretas (Landim)", newPatients),
            stack("IAD", (m) => extra(m, "IAD")),
            stack("Clivale", (m) => extra(m, "Clivale")),
            stack("Não convertidos", (m) =>
              leads(m) === null || attended(m) === null
                ? null
                : leads(m)! - attended(m)!,
            ),
          ]) +
            r.chart(
              "Receita × Investimento × CPL",
              [
                { label: "Receita (R$)", data: s.months.map(revenue) },
                { label: "Investimento (R$)", data: s.months.map(spend) },
                { label: "CPL (R$)", type: "line", data: s.months.map(cpl) },
              ],
              "currency",
            ),
        ) +
        r.trend("Taxa de conversão por mês (%)", finalRate, "percent", "line"),
    ),
    r.tab(
      "canais",
      "Canais & Investimento",
      () =>
        r.title("Canais & investimento — evolução") +
        r.grid(
          r.channelChart("Leads por canal por mês", "leads") +
            r.chart(
              "Investimento por canal × CPL pago",
              [
                ...channelNames(s)
                  .filter((n) =>
                    s.months.some((m) => chan(m, n)?.kind === "paid"),
                  )
                  .map((n) => ({
                    label: n,
                    data: s.months.map((m) => chan(m, n)?.investment ?? null),
                  })),
                {
                  label: "CPL pago (R$)",
                  type: "line",
                  data: s.months.map(cpl),
                },
              ],
              "currency",
            ),
        ) +
        r.table(
          "Detalhamento por canal e mês",
          [
            "Mês",
            "Canal",
            "Invest.",
            "Leads",
            "Conv.",
            "Novos pac.",
            "Receita",
            "CPL",
            "Taxa conv.",
          ],
          s.months.flatMap((m) =>
            m.data.channels.map((c) => [
              m.label,
              c.label,
              fmt(c.investment, "currency", 2),
              fmt(c.leads),
              fmt(c.conversions),
              fmt(c.newCustomers),
              fmt(c.revenue, "currency"),
              fmt(divide(c.investment, c.leads), "currency", 2),
              fmt(percent(c.conversions, c.leads), "percent"),
            ]),
          ),
        ),
    ),
    r.tab(
      "receita",
      "Receita & Cirurgias",
      () =>
        r.title("Receita & cirurgias — evolução") +
        r.grid(
          r.chart(
            "Receita por mês (convênio × particular)",
            ["Convênio", "Particular"].map((label) => ({
              label,
              data: s.months.map((m) =>
                quantity(m, ["Receita por tipo"], label, "revenue"),
              ),
              stack: "receita",
            })),
            "currency",
          ) +
            r.trend("Cirurgias geradas por mês", (m) =>
              extra(m, "Cirurgias geradas"),
            ),
        ) +
        r.importedTables((t) => /cirurgia/i.test(t.title), true) +
        r.importedTables((t) => /receita/i.test(t.title), true),
    ),
    r.tab(
      "leads",
      "Leads",
      () =>
        r.title("Perfil dos leads — evolução") +
        r.grid(
          r.chart(
            "Convênio × Particular por mês",
            ["Convênio", "Particular", "Não informado"].map((label) => ({
              label,
              data: s.months.map((m) =>
                quantity(m, ["Perfil dos leads"], label),
              ),
              stack: "tipo",
            })),
          ) +
            r.chart(
              "Procedimento buscado por mês",
              ["Consulta", "Fisioterapia", "Acupuntura"].map((label) => ({
                label,
                data: s.months.map((m) =>
                  quantity(m, ["Procedimentos"], label),
                ),
              })),
            ),
        ) +
        r.channelChart("Leads por canal por mês", "leads"),
    ),
    r.tab("mesames", "Mês a Mês", () => annual(r)),
    r.tab("insights", "Insights", () => r.insights()),
  ];
}
function serenityChannelsTab(r: Renderer) {
  const s = r.report,
    names = channelNames(s);
  const paidNames = names.filter((n) =>
    s.months.some((m) => chan(m, n)?.kind === "paid"),
  );
  const investment = (m: LiveMonth) => sum(paid(m).map((c) => c.investment));
  const attributed = (m: LiveMonth) =>
    m.data.financial?.attributedRevenue ?? sum(paid(m).map((c) => c.revenue));
  const net = (a: number | null, b: number | null) => {
    const v = divide(a, b);
    return v === null ? null : (v - 1) * 100;
  };
  let html = r.grid(
    r.chart(
      "Leads por Canal",
      [{ label: "Leads", data: names.map((n) => channelTotal(s, n, "leads")) }],
      "integer",
      "bar",
      names,
    ) +
      r.chart(
        "Receita por Canal",
        [
          {
            label: "Receita",
            data: names.map((n) => channelTotal(s, n, "revenue")),
          },
        ],
        "currency",
        "bar",
        names,
      ),
  );
  html += r.chart(
    "Receita dos Canais Pagos — Evolução Mensal",
    paidNames.map((label) => ({
      label,
      data: s.months.map((m) => chan(m, label)?.revenue ?? null),
      stack: "receita",
    })),
    "currency",
  );
  html += r.table(
    "Conversão e receita por canal",
    [
      "Canal",
      ...s.months.map((m) => m.label),
      "Leads",
      "Comparecimentos",
      "Conversão",
      "Receita",
      "%",
    ],
    names.map((label) => {
      const ls = channelTotal(s, label, "leads"),
        cs = channelTotal(s, label, "conversions"),
        rec = channelTotal(s, label, "revenue");
      return [
        label,
        ...s.months.map((m) => fmt(chan(m, label)?.leads)),
        fmt(ls),
        fmt(cs),
        fmt(percent(cs, ls), "percent"),
        fmt(rec, "currency"),
        fmt(
          percent(rec, sum(names.map((n) => channelTotal(s, n, "revenue")))),
          "percent",
        ),
      ];
    }),
  );
  html +=
    '<p class="nota">Na referência de janeiro a setembro de 2026, leads e comparecimentos por canal são mínimos documentados, com atribuição parcial em setembro. Os totais informados no original são preservados; não há divisão mensal inventada da receita orgânica.</p>';
  html +=
    r.section(
      "ROI geral acumulado (canais pagos)",
      r.kpis([
        [
          "ROI geral",
          net(total(s, attributed), total(s, investment)),
          "percent",
        ],
        ...paidNames.map(
          (label) =>
            [
              label,
              net(
                channelTotal(s, label, "revenue"),
                channelTotal(s, label, "investment"),
              ),
              "percent",
            ] as [string, number | null, ChartFormat],
        ),
      ]),
    ) +
    '<p class="nota">ROI = (receita dos canais pagos − investimento) ÷ investimento. A receita total da clínica não entra neste cálculo.</p>';
  html += r.grid(
    r.trend(
      "ROI Geral — Mix de Canais Pagos",
      (m) => net(attributed(m), investment(m)),
      "percent",
      "line",
    ) +
      r.chart(
        "ROI por Canal Pago",
        paidNames.map((label) => ({
          label,
          data: s.months.map((m) =>
            net(
              chan(m, label)?.revenue ?? null,
              chan(m, label)?.investment ?? null,
            ),
          ),
        })),
        "percent",
        "line",
      ),
  );
  html += r.table(
    "ROI por canal — detalhamento mensal",
    [
      "Canal",
      "Mês",
      "Investimento",
      "Receita",
      "Líquido",
      "ROI",
      "Retorno / R$ 1",
    ],
    paidNames.flatMap((label) =>
      s.months.map((m) => {
        const c = chan(m, label);
        return [
          label,
          m.label,
          fmt(c?.investment, "currency", 2),
          fmt(c?.revenue, "currency", 2),
          fmt(
            c?.revenue == null || c?.investment == null
              ? null
              : c.revenue - c.investment,
            "currency",
            2,
          ),
          fmt(net(c?.revenue ?? null, c?.investment ?? null), "percent"),
          fmt(divide(c?.revenue ?? null, c?.investment ?? null), "multiplier"),
        ];
      }),
    ),
  );
  return (
    html +
    r.table(
      "ROI mês a mês (canais pagos)",
      ["Mês", "Investimento", "Receita", "ROI", "Observação"],
      s.months.map((m) => [
        m.label,
        fmt(investment(m), "currency", 2),
        fmt(attributed(m), "currency", 2),
        fmt(net(attributed(m), investment(m)), "percent"),
        m.data.sectionNotes
          .filter((n) => /roi/i.test(n.section))
          .map((n) => n.text)
          .join(" "),
      ]),
    )
  );
}
function serenityTabs(r: Renderer): LiveTab[] {
  const s = r.report,
    m = s.focus;
  const dimensions = (name: string) => {
    const labels = unique(
      s.months.flatMap(
        (m) => dimension(m, name)?.rows.map((r) => r.label) ?? [],
      ),
    );
    return (
      r.grid(
        r.chart(
          "Atendimentos por " + name,
          [
            {
              label: "Atendimentos",
              data: labels.map((l) => dimensionTotal(s, name, l)),
            },
          ],
          "integer",
          name === "Massagens" || name === "Serviços" ? "doughnut" : "bar",
          labels,
          name !== "Massagens" && name !== "Serviços",
        ) +
          r.chart(
            "Receita por " + name,
            [
              {
                label: "Receita",
                data: labels.map((l) => dimensionTotal(s, name, l, "revenue")),
              },
            ],
            "currency",
            name === "Massagens" || name === "Serviços" ? "doughnut" : "bar",
            labels,
            name !== "Massagens" && name !== "Serviços",
          ),
      ) +
      r.chart(
        "Evolução mensal — " + name,
        labels.map((label) => ({
          label,
          data: s.months.map((m) => quantity(m, [name], label)),
        })),
        "integer",
        "line",
      ) +
      r.table(
        "Detalhamento por " + name,
        [name, ...s.months.map((m) => m.label), "Total", "Receita"],
        labels.map((label) => [
          label,
          ...s.months.map((m) => fmt(quantity(m, [name], label))),
          fmt(dimensionTotal(s, name, label)),
          fmt(dimensionTotal(s, name, label, "revenue"), "currency"),
        ]),
      )
    );
  };
  return [
    r.tab(
      "visao-geral",
      "Visão geral",
      () =>
        r.title(`${m.label} em foco`) +
        r.kpis([
          ["Receita", revenue(m), "currency"],
          ["Leads", leads(m)],
          ["Agendamentos", bookings(m)],
          ["Comparecimentos", attended(m)],
          ["Ticket médio", ticket(m), "currency"],
          ["Conversão", finalRate(m), "percent"],
          ["Novos clientes", m.data.customers?.new ?? null],
          ["Recorrentes", m.data.customers?.returning ?? null],
        ]) +
        note(m, "Funil") +
        r.section(
          "Acumulado do período",
          r.kpis([
            ["Receita total", total(s, revenue), "currency"],
            ["Total de leads", total(s, leads)],
            ["Comparecimentos", total(s, attended)],
            [
              "Taxa de conversão",
              percent(total(s, attended), total(s, leads)),
              "percent",
            ],
            [
              "Ticket médio",
              divide(total(s, revenue), total(s, attended)),
              "currency",
            ],
            [
              "Clientes recorrentes",
              total(s, (m) => m.data.customers?.returning ?? null),
            ],
            ["Novos clientes", total(s, (m) => m.data.customers?.new ?? null)],
            ["Investimento em Ads", total(s, spend), "currency"],
          ]),
        ) +
        r.grid(
          r.trend("Receita por Mês", revenue, "currency") +
            r.chart("Leads vs Comparecimentos", [
              { label: "Leads", data: s.months.map(leads) },
              { label: "Comparecimentos", data: s.months.map(attended) },
            ]) +
            r.trend("Taxa de Conversão", finalRate, "percent", "line") +
            r.chart("Novos vs Recorrentes", [
              {
                label: "Novos",
                data: s.months.map((m) => m.data.customers?.new ?? null),
                stack: "clientes",
              },
              {
                label: "Recorrentes",
                data: s.months.map((m) => m.data.customers?.returning ?? null),
                stack: "clientes",
              },
            ]),
        ) +
        r.table(
          "Detalhamento mensal",
          [
            "Mês",
            "Dias",
            "Leads",
            "Agendamentos",
            "Comparecimentos",
            "Conversão",
            "Receita",
            "Ticket médio",
            "Novos",
            "Recorrentes",
          ],
          s.months.map((m) => [
            m.label,
            fmt(m.data.days),
            fmt(leads(m)),
            fmt(bookings(m)),
            fmt(attended(m)),
            fmt(finalRate(m), "percent"),
            fmt(revenue(m), "currency"),
            fmt(ticket(m), "currency"),
            fmt(m.data.customers?.new),
            fmt(m.data.customers?.returning),
          ]),
        ) +
        annual(r),
    ),
    r.tab("canais", "Canais & ROI", () => serenityChannelsTab(r)),
    r.tab(
      "servicos",
      "Serviços",
      () =>
        dimensions("Massagens") +
        (s.months.some((m) => dimension(m, "Serviços"))
          ? dimensions("Serviços")
          : ""),
    ),
    r.tab(
      "terapeutas",
      "Terapeutas",
      () =>
        dimensions("Terapeutas") +
        (s.months.some((m) => dimension(m, "Profissionais"))
          ? dimensions("Profissionais")
          : ""),
    ),
    r.tab("insights", "Insights", () => r.insights()),
  ];
}
export function renderLiveCommercial(s: LiveCommercial): {
  tabs: LiveTab[];
  banner: string;
  period: string;
} {
  const r = new Renderer(s),
    m = s.focus;
  const banner = `<div class="month-banner"><div><p class="banner-label">Mês atual</p><h2 class="banner-month">${escapeHtml(m.label)} ${s.year}</h2></div>${[
    ["Leads", leads(m), "integer"],
    [
      s.profile === "larplan" ? "Vendas" : "Comparecimentos",
      attended(m),
      "integer",
    ],
    ["Receita", revenue(m), "currency"],
    ["Conversão", finalRate(m), "percent"],
    ["Ticket médio", ticket(m), "currency"],
  ]
    .map(
      ([label, value, type]) =>
        `<div class="banner-kpi"><strong class="bk-val">${fmt(value as number | null, type as ChartFormat)}</strong><p class="bk-lbl">${label}</p></div>`,
    )
    .join("")}</div>`;
  const tabs =
    s.profile === "landim"
      ? landimTabs(r)
      : s.profile === "larplan"
        ? larplanTabs(r)
        : s.profile === "serenity"
          ? serenityTabs(r)
          : [
              r.tab("geral", "Visão Geral", () => overview(r)),
              r.tab(
                "comparativo",
                "Comparativo Mensal",
                () =>
                  annual(r) +
                  r.grid(
                    r.chart(
                      "Receita e Investimento",
                      [
                        { label: "Receita", data: s.months.map(revenue) },
                        { label: "Investimento", data: s.months.map(spend) },
                      ],
                      "currency",
                    ) +
                      r.chart("Funil — Volumes", [
                        { label: "Leads", data: s.months.map(leads) },
                        { label: "Agendamentos", data: s.months.map(bookings) },
                        {
                          label: "Comparecimentos",
                          data: s.months.map(attended),
                        },
                      ]),
                  ),
              ),
              r.tab("roi", "ROI & Canais", () => roi(r)),
              r.tab("diagnostico", "Diagnóstico", () => r.insights()),
            ];
  return {
    tabs,
    banner: s.profile === "landim" || s.profile === "serenity" ? "" : banner,
    period: `${s.months[0].label} – ${m.label} / ${s.year}`,
  };
}
