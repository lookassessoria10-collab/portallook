import type { ChartConfiguration, TooltipItem } from "chart.js";

export type LandimTab = { id: string; label: string; html: string; charts: Array<{ id: string; config: unknown }> };

const money = (value: unknown, cents: boolean) => "R$ " + Number(value).toLocaleString("pt-BR", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
// The five callbacks used by the reference. No eval or remote script execution.
const callbacks = {
  "c=>c.dataset.label+': '+brl2(c.raw)": (c: TooltipItem<"bar">) => c.dataset.label + ": " + money(c.raw, true),
  "c=>c.dataset.label+': '+brl(c.raw)": (c: TooltipItem<"bar">) => c.dataset.label + ": " + money(c.raw, false),
  "c=>c.raw.toFixed(1).replace('.',',')+'%'": (c: TooltipItem<"line">) => Number(c.raw).toFixed(1).replace(".", ",") + "%",
  "v=>'R$ '+v": (v: number | string) => "R$ " + v,
  "v=>v+'%'": (v: number | string) => v + "%",
};

export const landimColorTokens: Record<string, string> = {
  "#5B2B86": "--dash-1", "#8E5BC6": "--dash-2", "#B48BDD": "--dash-4",
  "#C9A24B": "--dash-3", "#3B1A5B": "--text", "#DBD2E8": "--dash-other",
  "#E39A34": "--dash-3", "#2E9E6B": "--dash-8", "#B0357F": "--dash-6",
  "#D9556B": "--dash-5", "#EFE9F6": "--chart-grid", "rgba(91,43,134,.12)": "--primary-soft",
};

export function landimChartConfig(raw: unknown, token: (name: string) => string): ChartConfiguration {
  function revive(value: unknown): unknown {
    if (typeof value === "string" && landimColorTokens[value]) return token(landimColorTokens[value]);
    if (Array.isArray(value)) return value.map(revive);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.callback === "string") {
        const callback = callbacks[obj.callback as keyof typeof callbacks];
        if (!callback) throw new Error("Callback do relatório Landim não reconhecido");
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
  config.options.plugins.legend.labels = { color: token("--text-2") };
  for (const scale of Object.values(config.options.scales ?? {})) {
    if (scale) {
      scale.ticks = { ...scale.ticks, color: token("--chart-axis") };
      Object.assign(scale, { border: { color: token("--border-strong") } });
    }
  }
  return config;
}
