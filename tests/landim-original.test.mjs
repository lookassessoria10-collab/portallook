import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractLandim } from "../scripts/lib/extract-landim.mjs";
import report from "../src/features/commercial/landim/report.json";
import { landimChartConfig } from "../src/features/commercial/landim/chart-config";
import { isLandimOriginalReport } from "../src/features/commercial/presentation";

describe("Instituto Landim: fidelidade ao HTML oficial", () => {
  it("preserva todos os arrays, textos, tabelas e configurações do original", () => {
    const reference = readFileSync(new URL("../src/features/commercial/landim/original.html", import.meta.url), "utf8");
    expect(report).toEqual(extractLandim(reference));
    expect(report.tabs.map((tab) => tab.label)).toEqual(["Evolução", "Canais & Investimento", "Receita & Cirurgias", "Leads", "Mês a Mês", "Insights"]);
    expect(report.tabs.map((tab) => tab.charts.length)).toEqual([3, 2, 2, 3, 0, 0]);
  });

  it("mantém totais, atribuição e percentuais da fonte, incluindo os zeros de agosto", () => {
    const [july, august] = report.months;
    expect([july.leads, august.leads]).toEqual([49, 39]);
    expect([july.convTotal, august.convTotal]).toEqual([19, 9]);
    expect([july.convPct, august.convPct]).toEqual([38.8, 23.1]);
    expect([july.diretas, august.diretas]).toEqual([9, 1]);
    expect([july.receita, august.receita]).toEqual([13000, 0]);
    expect([july.investTotal, august.investTotal]).toEqual([1256.04, 1990.79]);
    expect([july.cplPago, august.cplPago]).toEqual([27.31, 53.81]);
    expect(july.receitaCanal).toEqual({ ind: 11600, google: 1400, meta: 0 });
    expect(report.months.reduce((total, month) => total + month.cirurgias, 0)).toBe(2);
    for (const month of report.months) {
      expect(month.receitaConv + month.receitaPart).toBe(month.receita);
      expect(Object.values(month.canalLeads).reduce((a, b) => a + b, 0)).toBe(month.leads);
      expect(month.diretas + month.iad + month.clivale).toBe(month.convTotal);
    }
  });

  it("converte somente cores e mantém datasets, empilhamento e eixos de cada gráfico", () => {
    for (const item of report.tabs.flatMap((tab) => tab.charts)) {
      const config = landimChartConfig(item.config, (name) => name);
      expect(config.data.labels).toEqual(item.config.data.labels);
      expect(config.data.datasets.map((d) => [d.type, d.label, d.data, d.yAxisID])).toEqual(item.config.data.datasets.map((d) => [d.type, d.label, d.data, d.yAxisID]));
      for (const [id, axis] of Object.entries(item.config.options.scales)) {
        expect(config.options.scales[id].stacked).toBe(axis.stacked);
        expect(config.options.scales[id].beginAtZero).toBe(axis.beginAtZero);
        expect(config.options.scales[id].position).toBe(axis.position);
      }
    }
  });

  it("reproduz os formatos de tooltip do original sem multiplicar percentuais", () => {
    const charts = report.tabs.flatMap((tab) => tab.charts);
    const get = (id) => landimChartConfig(charts.find((c) => c.id === id).config, (name) => name);
    expect(get("revInvChart").options.plugins.tooltip.callbacks.label({ dataset: { label: "Investimento (R$)" }, raw: 1990.79 })).toBe("Investimento (R$): R$ 1.990,79");
    expect(get("taxaChart").options.plugins.tooltip.callbacks.label({ raw: 23.1 })).toBe("23,1%");
    expect(get("revChart").options.plugins.tooltip.callbacks.label({ dataset: { label: "Convênio (R$)" }, raw: 10600 })).toBe("Convênio (R$): R$ 10.600");
  });

  it("se restringe ao Landim comercial de agosto e permite futuras importações", () => {
    expect(isLandimOriginalReport("instituto-landim", "commercial", "2026-08")).toBe(true);
    for (const [slug, tab, period] of [["instituto-landim", "commercial", "2026-09"], ["instituto-landim", "commercial", "2027-08"], ["instituto-landim", "traffic", "2026-08"], ["serenity-terapias", "commercial", "2026-08"], ["dra-isabor-sant-anna", "commercial", "2026-08"]]) {
      expect(isLandimOriginalReport(slug, tab, period)).toBe(false);
    }
  });
});
