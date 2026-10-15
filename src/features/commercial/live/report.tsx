import "server-only";
import type { LiveCommercial } from "./model";
import { renderLiveCommercial } from "./render";
import { LiveReportView } from "./report-view";

export function LiveCommercialReport({ report }: { report: LiveCommercial }) {
  return (
    <LiveReportView
      profile={report.profile}
      {...renderLiveCommercial(report)}
    />
  );
}
