import vm from "node:vm";

/** Executes the reviewed reference fixture locally, never remote code at runtime. */
export function extractLandim(html) {
  const nodes = new Map();
  const charts = [];
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { id, innerHTML: "", textContent: "" });
      return nodes.get(id);
    },
  };
  class Chart {
    static defaults = { font: {} };
    constructor(node, config) { charts.push({ id: node.id, config }); }
  }
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const context = vm.createContext({ document, Chart });
  vm.runInContext(script + `\nrenderCanais(); renderReceita(); renderLeads(); renderMesAMes(); renderInsights();`, context, { timeout: 1000 });
  const tabs = [...html.matchAll(/data-t="([^"]+)"[^>]*>(.*?)<\/button>/g)].map(([, id, label]) => ({
    id, label: label.replaceAll("&amp;", "&"), html: nodes.get(id).innerHTML,
    charts: charts.filter((c) => nodes.get(id).innerHTML.includes(`id="${c.id}"`)),
  }));
  const months = vm.runInContext("MONTHS", context);
  return JSON.parse(JSON.stringify({
    source: "https://clientes.lookassessoria.com.br/institutolandim/dashboard-comercial.html",
    period: nodes.get("periodChip").textContent,
    months, tabs,
  }, (_, value) => typeof value === "function" ? { callback: value.toString() } : value));
}
