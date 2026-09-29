"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisValue } from "@/lib/format/number";
import { ChartTooltipCard } from "./chart-tooltip";
import { SLOT_COLOR, type SeriesDef, type SeriesPoint } from "./types";

/** Uma série por vez, um eixo só. Área em lavagem de ~10%, linha de 2px. */
export default function TrendChart({ points, series, currency, height = 230 }: { points: SeriesPoint[]; series: SeriesDef; currency: string; height?: number }) {
  const color = SLOT_COLOR[series.slot ?? 1];
  const data = points.map((p) => ({ label: p.label, fullLabel: p.fullLabel, value: p.values[series.key] ?? null }));
  const lastIndex = data.length - 1;
  const gradientId = `trend-${series.key.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
            tickFormatter={(v: number) => formatAxisValue(v, series.format, currency)}
            width={series.format === "currency" ? 64 : 44}
            allowDecimals={series.format !== "integer"}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as (typeof data)[number];
              return <ChartTooltipCard title={row.fullLabel} currency={currency} rows={[{ label: series.label, value: row.value, format: series.format, color }]} />;
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            connectNulls
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === lastIndex && props.cx != null && props.cy != null ? (
                <circle key="last" cx={props.cx} cy={props.cy} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
              ) : (
                <g key={`d${props.index}`} />
              )
            }
            activeDot={{ r: 6, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
