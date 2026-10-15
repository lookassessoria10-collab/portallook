import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { extractLarplan } from "../scripts/lib/extract-larplan.mjs";
import report from "../src/features/commercial/larplan/report.json";
import { larplanChartConfig } from "../src/features/commercial/larplan/chart-config";
import { themeLarplanMarkup } from "../src/features/commercial/larplan/theme-markup";
import { isLarplanOriginalReport } from "../src/features/commercial/presentation";
import { loadPortalModel } from "../src/features/portal/model";
import { useMemoryStorage } from "./helpers/setup";
import { createClient } from "../src/features/clients/service";
import { createDraftReport, publishReport } from "../src/features/reports/service";
import { monthPeriod } from "../src/lib/dates/period";

const chart = (id) => report.tabs.flatMap((t) => t.charts).find((c) => c.id === id).config;
const clientInput = (slug) => ({ name: slug, shortName: slug, slug, greetingName: "", segment: "", currency: "BRL", notes: "", roiMetric: "roas", commercial: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: true }, traffic: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: true } });

describe("Larplan: reprodução do HTML original", () => {
  it("preserva integralmente o conteúdo, a ordem e as configurações dos seis gráficos", () => {
    const html = readFileSync(new URL("../src/features/commercial/larplan/original.html", import.meta.url), "utf8");
    expect(report).toEqual(extractLarplan(html));
    expect(report.tabs.map((t) => t.label)).toEqual(["Visão Geral", "Comparativo Mensal", "ROI & Canais", "Diagnóstico"]);
    expect(report.tabs.map((t) => t.charts.length)).toEqual([2, 2, 2, 0]);
    expect(report.tabs.map((t) => (t.html.match(/<table>/g) ?? []).length)).toEqual([1, 1, 1, 0]);
    expect(report.tabs[1].html).toContain('colspan="14"');
  });

  it("mantém os valores originais e diferencia receita total de receita paga", () => {
    expect(chart("receitaChart").data.datasets.map((d) => d.data)).toEqual([[26000, 137401.48, 139560.89], [916.45, 1418.37, 1681.82]]);
    expect(chart("funilChart").data.datasets.map((d) => d.data)).toEqual([[27, 53, 52], [1, 9, 5]]);
    expect(chart("convChart").data.datasets[0].data).toEqual([3.7, 17, 9.6]);
    expect(chart("canalChart").data.datasets[0].data).toEqual([73409.89, 66151]);
    expect(chart("roiMensalChart").data.datasets.map((d) => d.data)).toEqual([[28.4, 96.9, 82.9], [28.4, 10.7, 45.8], [null, null, 0]]);
    expect(report.tabs[2].html).toContain("R$ 302.962,37");
    expect(report.tabs[2].html).toContain("R$ 107.382,09");
  });

  it("preserva tipos, dados, legendas, tracejados e callbacks ao adaptar o tema", () => {
    for (const item of report.tabs.flatMap((t) => t.charts)) {
      const config = larplanChartConfig(item.config, (token) => token);
      expect(config.type).toBe(item.config.type);
      expect(config.data.datasets.map((d) => [d.type, d.data, d.label, d.borderDash, d.yAxisID])).toEqual(item.config.data.datasets.map((d) => [d.type, d.data, d.label, d.borderDash, d.yAxisID]));
      expect(config.options.cutout).toBe(item.config.options.cutout);
    }
    const doughnut = larplanChartConfig(chart("canalChart"), (t) => t);
    expect(doughnut.options.plugins.tooltip.callbacks.label({ label: "Google Ads", parsed: 66151 })).toBe("Google Ads: R$ 66.151,00");
    expect(doughnut.options.plugins.legend.labels).toMatchObject({ boxWidth: 10, padding: 12 });
  });

  it("altera somente atributos de cor da marcação e mantém todo o texto", () => {
    for (const tab of report.tabs) {
      const stripStyle = (html) => html.replace(/style="[^"]*"/g, "");
      expect(stripStyle(themeLarplanMarkup(tab.html))).toBe(stripStyle(tab.html));
    }
    expect(isLarplanOriginalReport("larplan", "commercial", "2026-08")).toBe(true);
    expect(isLarplanOriginalReport("larplan", "commercial", "2026-09")).toBe(false);
    expect(isLarplanOriginalReport("larplan", "traffic", "2026-08")).toBe(false);
  });
});

describe("Larplan sem planilha: integração e importações futuras", () => {
  beforeEach(() => useMemoryStorage());

  it("abre o original sem relatórios importados, mantendo tráfego e outros clientes intactos", async () => {
    const client = await createClient(clientInput("larplan"), null);
    const model = await loadPortalModel(client, { tab: "comercial", mode: "client" });
    expect(model.periodKey).toBe("2026-08");
    expect(model.periods).toHaveLength(1);
    expect(model.selection.dataset).toBeNull();
    expect((await loadPortalModel(client, { tab: "trafego", mode: "client" })).periods).toHaveLength(0);
    const other = await createClient(clientInput("outra-clinica"), null);
    expect((await loadPortalModel(other, { tab: "comercial", mode: "client" })).periods).toHaveLength(0);
  });

  it("abre períodos posteriores normalmente e mantém o original acessível sem duplicar agosto", async () => {
    const client = await createClient(clientInput("larplan"), null);
    for (const month of [8, 9]) {
      const draft = await createDraftReport({ clientId: client.id, type: "commercial", kind: "document", period: monthPeriod(2026, month), source: null });
      await publishReport(client.id, draft.id, null);
    }
    const latest = await loadPortalModel(client, { tab: "comercial", mode: "client" });
    expect(latest.periodKey).toBe("2026-09");
    expect(latest.periods.map((p) => p.key)).toEqual(["2026-08", "2026-09"]);
    const original = await loadPortalModel(client, { tab: "comercial", period: "2026-08", mode: "client" });
    expect(original.periodKey).toBe("2026-08");
    expect(isLarplanOriginalReport(client.slug, original.tab, original.periodKey)).toBe(true);
  });
});
