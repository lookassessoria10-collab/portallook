import "server-only";
import report from "../landim/report.json";
import { LandimReportView } from "./landim-report-view";

/** Kept on the server so patient details are sent only through the authorized portal. */
export function LandimFaithfulReport() {
  return <LandimReportView tabs={report.tabs} period={report.period} />;
}
