/**
 * Estes dois clientes usam o relatório comercial anual como peça única,
 * conforme os dashboards legados (sem páginas independentes para cada mês).
 * A edição e a prévia no ADM continuam com navegação mensal.
 */
export function isFullCommercialReport(slug: string, tab: string, mode: "client" | "preview"): boolean {
  return mode === "client" && tab === "commercial" && (
    slug === "serenity-terapias" || slug === "dra-isabor-sant-anna"
  );
}

/** Isabor usa o painel de funil, não o modelo de serviços/terapeutas da Serenity. */
export function isIsaborCommercialReport(slug: string): boolean {
  return slug === "dra-isabor-sant-anna";
}

/** Only the source's closing month; later imports keep their existing renderer. */
export function isLandimOriginalReport(slug: string, tab: string, periodKey: string | null): boolean {
  return slug === "instituto-landim" && tab === "commercial" && periodKey === "2026-08";
}
