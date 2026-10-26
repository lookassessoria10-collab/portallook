import { MONTHS_PT, MONTHS_SHORT_PT } from "@/lib/dates/period";
import { normalizeText } from "@/lib/ids";
import { applyContentRules, contentStatus } from "./rules";
import type { ContentItem, ContentRules, ContentStatus } from "./schema";

/** O que o portal recebe de cada conteúdo — a descrição só vai quando a regra permite. */
export interface PortalContentItem {
  id: string;
  date: string;
  time: string | null;
  title: string;
  format: string;
  formatColor: string;
  channel: string | null;
  status: ContentStatus;
  caption: string | null;
  description: string | null;
}

export interface PortalContentVM {
  items: PortalContentItem[];
  /** Meses navegáveis, em ordem (do primeiro ao último conteúdo do período). */
  months: Array<{ key: string; label: string }>;
  /** Mês aberto de início: o de hoje, quando tem conteúdo; senão o primeiro com conteúdo depois de hoje. */
  defaultMonth: string;
  today: string;
  /** "Out – Dez / 2026". */
  rangeLabel: string;
  fetchedAt: string;
}

/** Cores dos formatos mais usados; os outros seguem a paleta do painel. */
const FORMAT_COLORS: Record<string, string> = {
  card: "#4f8ff7",
  carrossel: "#2ec4b6",
  "card e story": "#e0b46c",
  reels: "#f08a5d",
  stories: "#b3a4ff",
  story: "#b3a4ff",
};
const EXTRA_COLORS = ["#e7799f", "#7fd3f7", "#a8d672", "#9b87f5", "#e0b46c"];
export const NO_FORMAT_COLOR = "#7d8fa8";

const BRANDS: Record<string, string> = { whatsapp: "WhatsApp", youtube: "YouTube", tiktok: "TikTok", linkedin: "LinkedIn", linktree: "Linktree", tv: "TV" };
const SMALL_WORDS = new Set(["e", "de", "da", "do", "das", "dos", "a", "o"]);

/** "CARD E STORY" → "Card e story". */
export function formatLabel(name: string | null): string {
  if (!name) return "Formato a definir";
  const lower = name.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "INSTAGRAM/FACEBOOK" → "Instagram / Facebook"; "WHATSAPP E STORIES" → "WhatsApp e Stories". */
export function channelLabel(name: string | null): string | null {
  if (!name) return null;
  return name
    .trim()
    .split("/")
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .split(" ")
        .map((w, i) => BRANDS[normalizeText(w)] ?? (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" "),
    )
    .join(" / ");
}

export function formatColor(name: string | null, seen: Map<string, string>): string {
  if (!name) return NO_FORMAT_COLOR;
  const key = normalizeText(name);
  if (FORMAT_COLORS[key]) return FORMAT_COLORS[key];
  if (!seen.has(key)) seen.set(key, EXTRA_COLORS[seen.size % EXTRA_COLORS.length]);
  return seen.get(key)!;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const monthLabel = (key: string) => `${capitalize(MONTHS_PT[+key.slice(5, 7) - 1])} de ${key.slice(0, 4)}`;
const SHORT = MONTHS_SHORT_PT.map(capitalize);

function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  let y = +first.slice(0, 4);
  let m = +first.slice(5, 7);
  const end = +last.slice(0, 4) * 12 + +last.slice(5, 7);
  while (y * 12 + m <= end) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Itens da lista → área Conteúdo do portal (null quando não sobra nada para mostrar). */
export function buildPortalContent(items: readonly ContentItem[], rules: ContentRules, today: string, fetchedAt: string): PortalContentVM | null {
  const { visible } = applyContentRules(items, rules);
  if (!visible.length) return null;
  const seen = new Map<string, string>();
  const sorted = [...visible].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.time ?? "") < (b.time ?? "") ? -1 : (a.time ?? "") > (b.time ?? "") ? 1 : a.name.localeCompare(b.name, "pt-BR")));
  const out: PortalContentItem[] = sorted.map((i) => ({
    id: i.id,
    date: i.date,
    time: i.time,
    title: i.name,
    format: formatLabel(i.format),
    formatColor: formatColor(i.format, seen),
    channel: channelLabel(i.channel),
    status: contentStatus(i),
    caption: rules.showCaption ? i.caption : null,
    description: rules.showDescription ? i.description : null,
  }));
  const keys = monthsBetween(out[0].date.slice(0, 7), out[out.length - 1].date.slice(0, 7));
  const current = today.slice(0, 7);
  const defaultMonth = out.some((i) => i.date.startsWith(current)) ? current : (out.find((i) => i.date >= today)?.date.slice(0, 7) ?? keys[keys.length - 1]);
  const first = keys[0];
  const last = keys[keys.length - 1];
  const rangeLabel =
    first === last
      ? `${SHORT[+first.slice(5, 7) - 1]} / ${first.slice(0, 4)}`
      : first.slice(0, 4) === last.slice(0, 4)
        ? `${SHORT[+first.slice(5, 7) - 1]} – ${SHORT[+last.slice(5, 7) - 1]} / ${last.slice(0, 4)}`
        : `${SHORT[+first.slice(5, 7) - 1]}/${first.slice(2, 4)} – ${SHORT[+last.slice(5, 7) - 1]}/${last.slice(2, 4)}`;
  return { items: out, months: keys.map((key) => ({ key, label: monthLabel(key) })), defaultMonth, today, rangeLabel, fetchedAt };
}
