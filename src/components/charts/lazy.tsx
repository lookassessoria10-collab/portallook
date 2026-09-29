"use client";

import dynamic from "next/dynamic";

function ChartSkeleton({ height = 230 }: { height?: number }) {
  return <div className="skeleton w-full" style={{ height }} role="status" aria-label="Carregando gráfico" />;
}

/** Recharts só é baixado quando um gráfico aparece na tela (code splitting). */
export const LazyTrendChart = dynamic(() => import("./trend-chart"), { ssr: false, loading: () => <ChartSkeleton /> });
export const LazyColumnsChart = dynamic(() => import("./columns-chart"), { ssr: false, loading: () => <ChartSkeleton /> });
