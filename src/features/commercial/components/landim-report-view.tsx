"use client";

import { useEffect, useRef, useState } from "react";
import type { Chart } from "chart.js";
import { landimChartConfig, type LandimTab } from "../landim/chart-config";
import styles from "./landim-faithful-report.module.css";

function LandimSection({ tab }: { tab: LandimTab }) {
  const root = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const node = root.current;
    if (!node || !tab.charts.length) return;
    let canceled = false;
    const instances: Chart[] = [];
    import("chart.js/auto").then(({ default: Chart }) => {
      if (canceled) return;
      const css = getComputedStyle(node);
      for (const item of tab.charts) {
        const canvas = node.querySelector<HTMLCanvasElement>(`#${item.id}`);
        if (!canvas) throw new Error(`Gráfico ausente: ${item.id}`);
        const title = canvas.closest(".chart-box")?.querySelector(".section-title")?.textContent?.trim();
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", title ?? item.id);
        instances.push(new Chart(canvas, landimChartConfig(item.config, (name) => css.getPropertyValue(name).trim())));
        canvas.dataset.ready = "true";
      }
    }).catch(() => { if (!canceled) setError(true); });
    return () => { canceled = true; instances.forEach((chart) => chart.destroy()); };
  }, [tab]);
  return <section role="tabpanel" id={`landim-${tab.id}`} aria-labelledby={`landim-tab-${tab.id}`}>
    {/* Reviewed local snapshot generated from original.html. Never user input or remote HTML. */}
    <div ref={root} dangerouslySetInnerHTML={{ __html: tab.html }} />
    {error ? <p role="alert">Não foi possível carregar os gráficos. Recarregue o relatório.</p> : null}
  </section>;
}

export function LandimReportView({ tabs, period }: { tabs: LandimTab[]; period: string }) {
  const [active, setActive] = useState(tabs[0].id);
  const selected = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return <div className={styles.report} data-landim-report>
    <div className={styles.heading}>
      <div><h2>Dashboard Comercial</h2><p>Instituto Landim - Funil, Mídia e Conversão</p></div>
      <span className="period-chip">{period}</span>
    </div>
    <nav aria-label="Seções do relatório comercial Instituto Landim" role="tablist">
      {tabs.map((tab) => <button key={tab.id} id={`landim-tab-${tab.id}`} type="button" role="tab" aria-selected={active === tab.id} aria-controls={`landim-${tab.id}`} className={`tab-btn${active === tab.id ? " active" : ""}`} onClick={() => setActive(tab.id)}>{tab.label}</button>)}
    </nav>
    <div className={styles.content}><LandimSection key={selected.id} tab={selected} /></div>
    <p className={styles.footer}>Instituto Landim · Dashboard Comercial · dados de acompanhamento de leads · 2026</p>
  </div>;
}
