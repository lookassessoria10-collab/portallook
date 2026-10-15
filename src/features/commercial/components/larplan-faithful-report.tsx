import "server-only";
import report from "../larplan/report.json";
import { LarplanReportView } from "./larplan-report-view";
import { themeLarplanMarkup } from "../larplan/theme-markup";

/** Source data stays on the server and is sent only through the authorized portal. */
export function LarplanFaithfulReport() {
  return <LarplanReportView tabs={report.tabs.map((tab) => ({ ...tab, html: themeLarplanMarkup(tab.html) }))} header={report.header} banner={report.banner} footer={report.footer} />;
}
