import type { ChartConfiguration, TooltipItem } from "chart.js";
import type { LiveChart } from "./render";

export function liveChartConfig(
  item: LiveChart,
  token: (name: string) => string,
): ChartConfiguration {
  const revive = (value: unknown): unknown => {
    if (typeof value === "string" && /^var\(--[\w-]+\)$/.test(value))
      return token(value.slice(4, -1));
    if (Array.isArray(value)) return value.map(revive);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, revive(v)]),
      );
    return value;
  };
  const config = revive(item.config) as ChartConfiguration;
  const format = (v: unknown) =>
    v == null
      ? "Não informado"
      : new Intl.NumberFormat(
          "pt-BR",
          item.format === "currency"
            ? { style: "currency", currency: "BRL" }
            : { maximumFractionDigits: item.format === "integer" ? 0 : 2 },
        ).format(Number(v)) +
        (item.format === "percent"
          ? "%"
          : item.format === "multiplier"
            ? "×"
            : "");
  config.options ??= {};
  config.options.color = token("--text-2");
  config.options.font = { family: token("--font-manrope") + ", sans-serif" };
  config.options.plugins ??= {};
  config.options.plugins.tooltip = {
    callbacks: {
      label: (ctx: TooltipItem<"bar">) =>
        `${config.type === "doughnut" ? ctx.label : (ctx.dataset.label ?? ctx.label)}: ${format(ctx.raw)}`,
    },
  };
  config.options.plugins.legend ??= {};
  config.options.plugins.legend.labels = { color: token("--text-2") };
  for (const [key, scale] of Object.entries(config.options.scales ?? {}))
    if (scale)
      scale.ticks = {
        ...scale.ticks,
        color: token("--chart-axis"),
        ...(key === (config.options.indexAxis === "y" ? "y" : "x")
          ? {}
          : { callback: (value: string | number) => format(value) }),
      };
  return config;
}
