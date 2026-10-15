import type { ChartConfiguration, TooltipItem } from "chart.js";

export type LarplanTab = { id: string; label: string; html: string; charts: Array<{ id: string; config: unknown }> };

const callbacks = {
  "v=>v+'%'": (v: number | string) => v + "%",
  "v=>v+'×'": (v: number | string) => v + "×",
  "v=>'R$'+v.toLocaleString('pt-BR')": (v: number | string) => "R$" + v.toLocaleString("pt-BR"),
  "ctx => ctx.label+': R$ '+ctx.parsed.toLocaleString('pt-BR',{minimumFractionDigits:2})": (ctx: TooltipItem<"doughnut">) => ctx.label + ": R$ " + Number(ctx.parsed).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
};

export const larplanColorTokens: Record<string, string> = {
  "#2A2723": "--text", "#C09A5A": "--dash-3", "#D4B47A": "--dash-7", "#E8D0A0": "--dash-2",
  "#4A8C6A": "--dash-2", "#C07830": "--dash-5", "#B85C4A": "--dash-5", "#3A6B9C": "--dash-1",
  "#6B4FA0": "--dash-4", "#A8A09A": "--dash-other", "#6B6560": "--text-2", "#E8E0D0": "--chart-grid", "#fff": "--surface",
  "rgba(192,154,90,.45)": "--dash-3", "rgba(74,140,106,.45)": "--dash-2", "rgba(192,120,48,.45)": "--dash-5",
  "rgba(184,92,74,.15)": "--negative-soft", "rgba(192,154,90,.5)": "--dash-3", "rgba(74,140,106,.6)": "--dash-2",
  "rgba(192,154,90,.1)": "--attention-soft", "rgba(58,107,156,.08)": "--primary-soft", "rgba(107,79,160,.08)": "--info-soft",
};

export function larplanChartConfig(raw: unknown, token: (name: string) => string): ChartConfiguration {
  function revive(value: unknown): unknown {
    if (typeof value === "string" && larplanColorTokens[value]) return token(larplanColorTokens[value]);
    if (Array.isArray(value)) return value.map(revive);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.callback === "string") {
        const callback = callbacks[obj.callback as keyof typeof callbacks];
        if (!callback) throw new Error("Callback do relatório Larplan não reconhecido");
        return callback;
      }
      return Object.fromEntries(Object.entries(obj).map(([key, item]) => [key, revive(item)]));
    }
    return value;
  }
  const config = revive(raw) as ChartConfiguration;
  // Mixed charts in the HTML specify the type per dataset, not at root.
  config.type ??= "bar";
  config.options ??= {};
  config.options.color = token("--text-2");
  config.options.font = { family: token("--font-manrope") + ", sans-serif" };
  config.options.plugins ??= {};
  config.options.plugins.legend ??= {};
  config.options.plugins.legend.labels = { ...config.options.plugins.legend.labels, color: token("--text-2"), font: { family: token("--font-manrope") + ", sans-serif", size: 12 } };
  for (const scale of Object.values(config.options.scales ?? {})) {
    if (scale) {
      scale.ticks = { ...scale.ticks, color: token("--chart-axis") };
      Object.assign(scale, { border: { color: token("--border-strong") } });
    }
  }
  return config;
}
