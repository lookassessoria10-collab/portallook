import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryStorage } from "./helpers/setup";
import { createClient } from "@/features/clients/service";
import type { ClientInput } from "@/features/clients/input";
import { createDraftReport, publishReport } from "@/features/reports/service";
import {
  initImport,
  receiveFile,
  processImport,
  confirmImport,
} from "@/features/uploads/service";
import { loadPortalModel } from "@/features/portal/model";
import { clientCommercialWorkbook } from "@/features/commercial/live/templates";
import {
  commercialProfiles,
  type CommercialProfile,
} from "@/features/commercial/live/profiles";
import {
  mergeCommercialMonths,
  referenceMonths,
  type LiveMonth,
  leads,
  revenue,
  sum,
} from "@/features/commercial/live/model";
import { renderLiveCommercial } from "@/features/commercial/live/render";
import { liveChartConfig } from "@/features/commercial/live/chart-config";
import { CommercialDataSchema } from "@/features/commercial/schema";
import { workbookBuffer } from "@/features/uploads/templates";
import { readExcel } from "@/lib/parsers/xlsx";
import { normalizeCommercial } from "@/features/commercial/normalize";
import { IssueCollector } from "@/features/uploads/issues";
import { monthPeriod } from "@/lib/dates/period";

function clientInput(slug: string): ClientInput {
  return {
    name: slug,
    shortName: slug,
    slug,
    greetingName: "",
    segment: "",
    currency: "BRL",
    notes: "",
    roiMetric: "roas",
    commercial: {
      enabled: true,
      cadence: "monthly",
      dueDay: 5,
      allowOriginalDownload: false,
    },
    traffic: {
      enabled: false,
      cadence: "monthly",
      dueDay: 5,
      allowOriginalDownload: false,
    },
  };
}
function fixture(
  profile: CommercialProfile,
  period = "10/2026",
  income = 4567.89,
) {
  const wb = clientCommercialWorkbook(profile);
  const write = (name: string, rows: Array<Array<string | number | null>>) => {
    wb.Sheets[name] = XLSX.utils.aoa_to_sheet(rows);
  };
  // Numeric values are testing fixtures, never uploaded to a real client.
  for (const name of wb.SheetNames) {
    if (name === "Instruções" || name === "Layout comercial") continue;
    const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(
      wb.Sheets[name],
      { header: 1, defval: null },
    );
    for (const row of rows.slice(1)) {
      row[0] = period;
      for (let i = 1; i < row.length; i++)
        if (row[i] === null)
          row[i] = i === 4 && name !== "Financeiro" ? null : 3;
    }
    write(name, rows);
  }
  write(
    "Funil",
    profile === "landim"
      ? [
          ["Período", "Leads", "Conversões totais"],
          [period, 100, 10],
        ]
      : profile === "larplan"
        ? [
            ["Período", "Leads", "Em contato", "Propostas enviadas", "Vendas"],
            [period, 100, 50, 20, 10],
          ]
        : [
            [
              "Período",
              "Leads",
              "Agendamentos",
              "Comparecimentos",
              "Dias registrados",
            ],
            [period, 100, 20, 10, 30],
          ],
  );
  write("Financeiro", [
    [
      "Período",
      "Receita",
      "Investimento em mídia",
      "Vendas",
      "Receita atribuída",
    ],
    [period, income, 100, 10, 200],
  ]);
  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(
    wb.Sheets.Canais,
    { header: 1, defval: null },
  );
  for (const row of rows.slice(1)) {
    row[3] = 10;
    row[4] = 2;
    row[5] = row[2] === "Mídia paga" ? 100 : 50;
    row[6] = row[2] === "Mídia paga" ? 50 : 0;
    row[7] = 1;
  }
  write("Canais", rows);
  write("Insights", [
    ["Período", "Tipo", "Tema", "Título", "Descrição"],
    [
      period,
      "Positivo",
      "Funil",
      "Análise do mês novo",
      "Texto exclusivo da importação",
    ],
  ]);
  write("Plano de ação", [
    ["Período", "Prioridade", "Ação", "Detalhes"],
    [period, "Alta", "Ação atual", "Detalhe atual"],
  ]);
  if (profile === "serenity")
    write("Terapeutas", [
      ["Período", "Item", "Quantidade", "Receita"],
      [period, "Profissional novo", 4, 800],
    ]);
  if (profile === "landim") {
    write("Cirurgias geradas", [
      ["Período", "Paciente", "Descrição", "Canal"],
      [period, "Paciente de teste", "Cirurgia de teste", "Indicação"],
    ]);
    write("Receita detalhada", [
      ["Período", "Paciente", "Canal", "Tipo", "Valor"],
      [period, "Paciente de teste", "Indicação", "Particular", income],
    ]);
  }
  if (profile === "larplan")
    write("Indicadores", [
      ["Período", "Indicador", "Valor", "Formato"],
      [period, "Meta de conversão", "15%", "Percentual"],
    ]);
  return wb;
}
function parse(
  profile: CommercialProfile,
  period = "10/2026",
  income = 4567.89,
) {
  const issues = new IssueCollector();
  const result = normalizeCommercial(
    readExcel(workbookBuffer(fixture(profile, period, income)), "xlsx"),
    { granularity: "month", requestedPeriod: null },
    issues,
  );
  expect(issues.errors).toEqual([]);
  return {
    data: CommercialDataSchema.parse(result.periods[0].data),
    insights: result.periods[0].insights.map((i, index) => ({
      ...i,
      id: `test-${index}`,
      source: "import" as const,
    })),
  };
}
async function importWorkbook(clientId: string, wb: XLSX.WorkBook) {
  const body = workbookBuffer(wb);
  const init = await initImport({
    clientId,
    reportType: "commercial",
    fileName: "comercial.xlsx",
    size: body.length,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    period: monthPeriod(2026, 10),
  });
  await receiveFile(init.importId, body);
  return processImport(init.importId);
}

describe("comercial mensal nos quatro layouts", () => {
  beforeEach(() => useMemoryStorage());
  for (const [slug, profile] of Object.entries(commercialProfiles)) {
    it(`${profile}: XLSX → rascunho → prévia → publicação → layout, sem alterar histórico`, async () => {
      const client = await createClient(clientInput(slug), null);
      const original = referenceMonths(profile);
      const raw = JSON.stringify(original);
      const record = await importWorkbook(client.id, fixture(profile));
      expect(record.status).toBe("validated");
      const done = await confirmImport(record.id, { periodKeys: ["2026-10"] });
      const draft = await loadPortalModel(client, {
        tab: "comercial",
        mode: "preview",
        focusReportId: done.reportIds[0],
      });
      expect(draft.liveCommercial?.focus.data.layoutProfile).toBe(profile);
      const before = await loadPortalModel(client, {
        tab: "comercial",
        mode: "client",
      });
      expect(before.liveCommercial).toBeNull();
      await publishReport(client.id, done.reportIds[0], null);
      const model = await loadPortalModel(client, {
        tab: "comercial",
        mode: "client",
      });
      const live = model.liveCommercial!;
      expect(live.profile).toBe(profile);
      expect(live.focus.key).toBe("2026-10");
      expect(live.months).toHaveLength(original.length + 1);
      expect(sum(live.months.map(revenue))).toBeCloseTo(
        sum(original.map(revenue))! + 4567.89,
        2,
      );
      expect(leads(live.focus)).toBe(100);
      const rendered = renderLiveCommercial(live);
      expect(rendered.tabs).toHaveLength(
        profile === "landim" ? 6 : profile === "serenity" ? 5 : 4,
      );
      expect(rendered.tabs.flatMap((t) => t.charts)).toHaveLength(
        profile === "landim"
          ? 10
          : profile === "serenity"
            ? 15
            : profile === "isabor"
              ? 6
              : 6,
      );
      const graphValues = rendered.tabs
        .flatMap((t) => t.charts)
        .flatMap((c) =>
          (
            c.config.data as { datasets: Array<{ data: Array<number | null> }> }
          ).datasets.flatMap((d) => d.data),
        );
      expect(graphValues).toContain(4567.89);
      expect(graphValues).toContain(100);
      for (const tab of rendered.tabs) {
        expect(tab.html.match(/<canvas /g) ?? []).toHaveLength(
          tab.charts.length,
        );
        for (const chart of tab.charts)
          expect(
            liveChartConfig(chart, () => "#123456").options?.responsive,
          ).toBe(true);
      }
      expect(rendered.tabs.at(-1)?.html).toContain("Análise do mês novo");
      expect(rendered.tabs.at(-1)?.html).toContain("Ação atual");
      expect(JSON.stringify(referenceMonths(profile))).toBe(raw);
      // Publish a correction: the previous month version must not be counted twice.
      const correction = await importWorkbook(
        client.id,
        fixture(profile, "10/2026", 8901.23),
      );
      const corrected = await confirmImport(correction.id, {
        periodKeys: ["2026-10"],
      });
      await publishReport(client.id, corrected.reportIds[0], null);
      const revised = (
        await loadPortalModel(client, { tab: "comercial", mode: "client" })
      ).liveCommercial!;
      expect(revised.months).toHaveLength(original.length + 1);
      const revisedValues = renderLiveCommercial(revised)
        .tabs.flatMap((t) => t.charts)
        .flatMap((c) =>
          (
            c.config.data as { datasets: Array<{ data: Array<number | null> }> }
          ).datasets.flatMap((d) => d.data),
        );
      expect(revisedValues).toContain(8901.23);
      expect(revisedValues).not.toContain(4567.89);
      expect(sum(revised.months.map(revenue))).toBeCloseTo(
        sum(original.map(revenue))! + 8901.23,
        2,
      );
    });
  }
  it("preserva snapshots antigos até um modelo identificado substituir o mês explicitamente", async () => {
    const client = await createClient(
      clientInput("dra-isabor-sant-anna"),
      null,
    );
    const { data, insights } = parse("isabor", "09/2026");
    const legacy = { ...data };
    delete legacy.layoutProfile;
    const old = await createDraftReport({
      clientId: client.id,
      type: "commercial",
      kind: "dataset",
      period: data.period,
      source: null,
      data: { type: "commercial", data: legacy },
    });
    await publishReport(client.id, old.id, null);
    expect(
      (await loadPortalModel(client, { tab: "comercial", mode: "client" }))
        .liveCommercial,
    ).toBeNull();
    const fresh = await createDraftReport({
      clientId: client.id,
      type: "commercial",
      kind: "dataset",
      period: data.period,
      source: null,
      data: { type: "commercial", data },
      insights,
    });
    await publishReport(client.id, fresh.id, null);
    const model = await loadPortalModel(client, {
      tab: "comercial",
      mode: "client",
    });
    expect(model.liveCommercial?.months).toHaveLength(5);
    expect(model.liveCommercial?.focus.data.financial?.revenue).toBe(4567.89);
  });
  it("recusa modelo de outro cliente e mantém demais clientes no fluxo genérico", async () => {
    const client = await createClient(clientInput("outro-cliente"), null);
    const wrong = await importWorkbook(client.id, fixture("larplan"));
    expect(wrong.status).toBe("invalid");
    expect(wrong.issues.some((i) => i.code === "client_mismatch")).toBe(true);
    expect(
      (await loadPortalModel(client, { tab: "comercial", mode: "client" }))
        .liveCommercial,
    ).toBeNull();
  });
  it("Serenity: percentuais são calculados sobre mídia atribuída, sem multiplicação indevida", () => {
    const parsed = parse("serenity");
    const month: LiveMonth = {
      key: "2026-10",
      label: "Outubro",
      ...parsed,
      imported: true,
    };
    const s = mergeCommercialMonths("serenity", [month], "2026-10");
    const tab = renderLiveCommercial(s).tabs.find((t) => t.id === "canais")!;
    const graph = tab.charts.find((c) =>
      JSON.stringify(c.config).includes("ROI Geral — Mix"),
    )!;
    const data = (graph.config.data as { datasets: Array<{ data: number[] }> })
      .datasets[0].data;
    expect(data.at(-1)).toBe(100); // (200 - 100) / 100 × 100, not total revenue / spend.
    const larplan = parse("larplan");
    expect(
      larplan.data.extraMetrics.find((e) => e.label === "Meta de conversão")
        ?.value,
    ).toBe(0.15);
  });
  it("mantém zero distinto de ausente e escapa textos importados em HTML", () => {
    expect(sum([1, null])).toBeNull();
    expect(sum([0, 0])).toBe(0);
    const { data } = parse("landim");
    data.funnel[0].value = 0;
    data.tables = [
      {
        key: "livre",
        title: "<script>injetado</script>",
        columns: ["Texto"],
        rows: [["<img src=x onerror=alert(1)>"]],
      },
    ];
    const s = mergeCommercialMonths(
      "landim",
      [
        {
          key: "2026-10",
          label: "Outubro",
          data,
          insights: [],
          imported: true,
        },
      ],
      "2026-10",
    );
    const html = renderLiveCommercial(s).tabs.at(-1)!.html;
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });
  it("não transporta dados entre anos e não altera os snapshots originais", () => {
    const parsed = parse("larplan");
    parsed.data.period = monthPeriod(2027, 1);
    const s = mergeCommercialMonths(
      "larplan",
      [{ key: "2027-01", label: "Janeiro", ...parsed, imported: true }],
      "2027-01",
    );
    expect(s.months.map((m) => m.key)).toEqual(["2027-01"]);
    expect(s.year).toBe(2027);
  });
});
