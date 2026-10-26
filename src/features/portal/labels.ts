import type { PortalArea, PortalTab } from "@/features/portal/model";
import { REPORT_TYPE_LABEL } from "@/features/reports/schema";

export const TAB_LABEL: Record<PortalTab, string> = REPORT_TYPE_LABEL;

export const AREA_LABEL: Record<PortalArea, string> = { ...REPORT_TYPE_LABEL, content: "Conteúdo", actions: "Ações" };
