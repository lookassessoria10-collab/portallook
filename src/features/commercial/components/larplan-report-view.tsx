"use client";

import { useEffect, useRef, useState } from "react";
import type { Chart } from "chart.js";
import { larplanChartConfig, type LarplanTab } from "../larplan/chart-config";
import styles from "./larplan-faithful-report.module.css";

function LarplanSection({ tab }: { tab: LarplanTab }) {
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
        const title = canvas.closest(".card, .roi-hero")?.querySelector("h3, .lbl")?.textContent?.trim();
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", title ?? item.id);
        instances.push(new Chart(canvas, larplanChartConfig(item.config, (name) => css.getPropertyValue(name).trim())));
        canvas.dataset.ready = "true";
      }
    }).catch(() => { if (!canceled) setError(true); });
    return () => { canceled = true; instances.forEach((chart) => chart.destroy()); };
  }, [tab]);
  return <section role="tabpanel" id={`larplan-${tab.id}`} aria-labelledby={`larplan-tab-${tab.id}`}>
    {/* Reviewed local snapshot generated from original.html. Never user input or remote HTML. */}
    <div ref={root} dangerouslySetInnerHTML={{ __html: tab.html }} />
    {error ? <p role="alert">Não foi possível carregar os gráficos. Recarregue o relatório.</p> : null}
  </section>;
}

export function LarplanReportView({ tabs, header, banner, footer }: { tabs: LarplanTab[]; header: string; banner: string; footer: string }) {
  const [active, setActive] = useState(tabs[0].id);
  const selected = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return <div className={styles.report} data-larplan-report>
    <div dangerouslySetInnerHTML={{ __html: header + banner }} />
    <nav className="tabs" aria-label="Seções do relatório comercial Larplan" role="tablist">
      {tabs.map((tab) => <button key={tab.id} id={`larplan-tab-${tab.id}`} type="button" role="tab" aria-selected={active === tab.id} aria-controls={`larplan-${tab.id}`} className={`tab${active === tab.id ? " active" : ""}`} onClick={() => setActive(tab.id)}>{tab.label}</button>)}
    </nav>
    <LarplanSection key={selected.id} tab={selected} />
    <footer>{footer}</footer>
  </div>;
}
