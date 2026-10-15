/** Only inline decoration is recolored. All source text and numbers stay untouched. */
export function themeLarplanMarkup(html: string): string {
  const colors: Record<string, string> = {
    "#3A6B9C": "var(--dash-1)", "#4A8C6A": "var(--dash-2)", "#6B4FA0": "var(--dash-4)",
  };
  return html.replace(/style="([^"]*)"/g, (_, style: string) => 'style="' + style
    .replace(/#[a-fA-F0-9]{6}/g, (color) => colors[color] ?? color)
    .replace(/background:var\(--dk9\)/g, "background:var(--surface-3)") + '"');
}
