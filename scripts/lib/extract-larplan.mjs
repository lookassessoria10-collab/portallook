import vm from "node:vm";

/** Capture all chart configurations from the reviewed local source, without a browser CDN. */
export function extractLarplan(html) {
  const charts = [];
  class Chart {
    static defaults = { font: {} };
    constructor(node, config) { charts.push({ id: node.id, config }); }
  }
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    Chart, document: { getElementById: (id) => ({ id }) },
  }, { timeout: 1000 });
  const tabs = [...html.matchAll(/<button class="tab[^\"]*" onclick="showTab\('([^']+)',this\)">(.*?)<\/button>/g)].map(([, id, label]) => {
    const section = html.split(`<div id="tab-${id}" class="tab-pane${id === "visao" ? " active" : ""}">`)[1].split(`</div><!-- /tab-${id} -->`)[0];
    return { id, label: label.replaceAll("&amp;", "&"), html: section, charts: charts.filter((c) => section.includes(`id="${c.id}"`)) };
  });
  return JSON.parse(JSON.stringify({
    source: "https://clientes.lookassessoria.com.br/larplan/dashboard-comercial.html",
    periodKey: "2026-08", period: "Junho – Agosto / 2026",
    header: html.match(/<header class="topbar">[\s\S]*?<\/header>/)[0],
    banner: html.split("<!-- BANNER MÊS ATUAL -->")[1].split("<!-- TABS -->")[0].trim(),
    footer: html.match(/<footer>(.*?)<\/footer>/)[1], tabs,
  }, (_, value) => typeof value === "function" ? { callback: value.toString() } : value));
}
