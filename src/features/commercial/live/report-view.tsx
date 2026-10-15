"use client";
import { useEffect, useRef, useState } from "react";
import type { Chart } from "chart.js";
import type { LiveTab } from "./render";
import type { CommercialProfile } from "./model";
import { liveChartConfig } from "./chart-config";
import landim from "../components/landim-faithful-report.module.css";
import standard from "../components/larplan-faithful-report.module.css";
import styles from "./report.module.css";

function Section({ tab }: { tab: LiveTab }) {
  const root = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let canceled = false;
    const instances: Chart[] = [];
    import("chart.js/auto")
      .then(({ default: Chart }) => {
        const node = root.current;
        if (canceled || !node) return;
        const css = getComputedStyle(node);
        for (const item of tab.charts) {
          const canvas = node.querySelector<HTMLCanvasElement>(`#${item.id}`);
          if (!canvas) throw new Error("Canvas ausente");
          instances.push(
            new Chart(
              canvas,
              liveChartConfig(item, (name) =>
                css.getPropertyValue(name).trim(),
              ),
            ),
          );
          canvas.dataset.ready = "true";
        }
      })
      .catch(() => {
        if (!canceled) setFailed(true);
      });
    return () => {
      canceled = true;
      instances.forEach((chart) => chart.destroy());
    };
  }, [tab]);
  return (
    <>
      <div ref={root} dangerouslySetInnerHTML={{ __html: tab.html }} />
      {failed ? (
        <p role="alert">
          Não foi possível carregar os gráficos. Recarregue o relatório.
        </p>
      ) : null}
    </>
  );
}

export function LiveReportView({
  profile,
  tabs,
  banner,
  period,
}: {
  profile: CommercialProfile;
  tabs: LiveTab[];
  banner: string;
  period: string;
}) {
  const [active, setActive] = useState(tabs[0].id);
  const selected = tabs.find((t) => t.id === active) ?? tabs[0];
  const isLandim = profile === "landim";
  return (
    <div
      className={`${isLandim ? landim.report : standard.report} ${styles.report}`}
      data-commercial-profile={profile}
    >
      {isLandim ? (
        <div className={landim.heading}>
          <div>
            <h2>Dashboard Comercial</h2>
            <p>Instituto Landim - Funil, Mídia e Conversão</p>
          </div>
          <span className="period-chip">{period}</span>
        </div>
      ) : null}
      {banner ? <div dangerouslySetInnerHTML={{ __html: banner }} /> : null}
      <nav
        role="tablist"
        aria-label="Seções do relatório comercial"
        className={isLandim ? "" : "tabs"}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            id={`commercial-tab-${t.id}`}
            role="tab"
            aria-controls={`commercial-panel-${t.id}`}
            aria-selected={t.id === selected.id}
            className={`${isLandim ? "tab-btn" : "tab"}${t.id === selected.id ? " active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <section
        role="tabpanel"
        id={`commercial-panel-${selected.id}`}
        aria-labelledby={`commercial-tab-${selected.id}`}
        className={isLandim ? landim.content : undefined}
      >
        <Section key={`${selected.id}-${period}`} tab={selected} />
      </section>
    </div>
  );
}
