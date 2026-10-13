import type { ReactNode } from "react";
import { Repeat, Megaphone, Percent, Receipt, Star, UserCheck, Users, Wallet } from "lucide-react";
import { EMPTY_VALUE, formatCurrency, formatHeadlineValue, formatValue, isFiniteNumber, type ValueFormat } from "@/lib/format/number";
import { LazyDistributionChart, LazyXYChart } from "@/components/charts/lazy";
import { cn } from "@/lib/cn";
import type { Accent, BadgeTone, CardIcon, ChartPoint, ChartSpec, Delta, DistributionSpec } from "@/features/commercial/dashboard";

export const ACCENT: Record<Accent, string> = {
  cyan: "var(--primary)",
  blue: "var(--dash-1)",
  teal: "var(--dash-2)",
  sky: "var(--dash-7)",
  gold: "var(--dash-3)",
  green: "var(--positive)",
  purple: "var(--dash-4)",
  orange: "var(--dash-5)",
};

const ICON: Record<CardIcon, typeof Users> = {
  revenue: Wallet,
  leads: Users,
  conversions: UserCheck,
  rate: Percent,
  ticket: Receipt,
  returning: Repeat,
  new: Star,
  investment: Megaphone,
};

/** Tabelas: moeda sem centavos (exceto investimentos); taxas com uma casa. */
export function cell(value: number | null | undefined, format: ValueFormat, currency: string, cents = false): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  if (format === "currency") return formatCurrency(value, currency, { noCents: !cents });
  return formatValue(value, format, currency);
}

/** Destaques: sem centavos a partir de R$ 100 e compactos a partir de R$ 100 mil ("R$ 106,8 mil"). */
export function headline(value: number | null | undefined, format: ValueFormat, currency: string): string {
  if (format === "currency" && isFiniteNumber(value) && Math.abs(value) >= 100 && Math.abs(value) < 100_000) return formatCurrency(value, currency, { noCents: true });
  return formatHeadlineValue(value, format, currency);
}

/** ROI com sinal: "+329%", "−40,0%". */
export function signedPercent(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  const text = formatValue(Math.abs(value), "percent");
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
}

/** "R$ 4,29" — quanto voltou para cada R$ 1 investido. */
export function perReal(value: number | null | undefined, currency: string): string {
  return isFiniteNumber(value) ? formatCurrency(value, currency) : EMPTY_VALUE;
}

export function SectionLabel({ children, note, className, id }: { children: ReactNode; note?: ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("dash-label mb-3.5", className)}>
      <span className="min-w-0">
        {children}
        {note ? <span className="ml-2 font-medium normal-case tracking-normal text-text-3">· {note}</span> : null}
      </span>
    </h2>
  );
}

const TONE: Record<BadgeTone, string> = {
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  attention: "bg-attention-soft text-attention",
  info: "bg-info-soft text-info",
  neutral: "bg-neutral-soft text-text-2",
  primary: "bg-primary-soft text-primary",
};

export function Pill({ tone, children, title, className }: { tone: BadgeTone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-[0.02em]", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function DeltaPill({ delta }: { delta: Delta | null }) {
  if (!delta) return <span className="text-text-3">{EMPTY_VALUE}</span>;
  if (delta.direction === "flat") return <span className="text-xs font-semibold text-text-3">= {delta.text}</span>;
  return <Pill tone={delta.direction === "up" ? "positive" : "negative"}>{delta.text}</Pill>;
}

/** Variação no destaque do mês: "▲ +12,3%" / "▼ −19,4%" / "= 0,0%". */
export function DeltaText({ delta, className }: { delta: Delta | null; className?: string }) {
  if (!delta) return <span className={cn("text-[11px] font-semibold text-white/45", className)}>sem comparação</span>;
  const tone = delta.direction === "up" ? "text-[#6fe3c4]" : delta.direction === "down" ? "text-[#ff9aa7]" : "text-white/60";
  const arrow = delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "=";
  return (
    <span className={cn("tabular text-[11px] font-bold", tone, className)}>
      {arrow} {delta.text}
    </span>
  );
}

export function AccentCard({ label, value, sub, accent, icon }: { label: string; value: string; sub: string | null; accent: Accent; icon: CardIcon }) {
  const Icon = ICON[icon];
  const color = ACCENT[accent];
  return (
    <div className="card relative min-w-0 p-5 transition-transform duration-200 hover:-translate-y-px">
      <span className="absolute inset-x-5 top-0 h-[2px] rounded-b-[3px]" style={{ background: color }} aria-hidden />
      <span className="mb-3 grid size-9 place-items-center rounded-[10px]" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }} aria-hidden>
        <Icon className="size-[17px]" />
      </span>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-3">{label}</p>
      <p className="tabular mt-1.5 truncate text-[1.3rem] font-bold leading-none min-[420px]:text-[1.625rem]" style={{ color }} title={value}>
        {value}
      </p>
      {sub ? <p className="mt-2 text-xs text-text-3">{sub}</p> : null}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card min-w-0 p-5 sm:p-6", className)}>{children}</div>;
}

export function PanelHead({ title, unit, children }: { title: string; unit?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-2">{title}</h3>
      {children ?? (unit ? <span className="text-[11px] text-text-3">{unit}</span> : null)}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ key: string; label: string; color: string }> }) {
  if (items.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1" aria-label="Legenda">
      {items.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-xs text-text-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartPanel({ chart, points, currency, height, className }: { chart: ChartSpec; points: ChartPoint[]; currency: string; height?: number; className?: string }) {
  return (
    <Panel className={className}>
      <PanelHead title={chart.title} unit={chart.unit} />
      <Legend items={chart.series} />
      <figure aria-label={chart.title}>
        <LazyXYChart points={points} series={chart.series} kind={chart.kind} highlight={chart.highlight} currency={currency} height={height} />
      </figure>
    </Panel>
  );
}

export function DistributionPanel({ spec, currency }: { spec: DistributionSpec; currency: string }) {
  return (
    <Panel>
      <PanelHead title={spec.title} unit={spec.unit} />
      <figure aria-label={spec.title}>
        <LazyDistributionChart slices={spec.slices} kind={spec.kind} format={spec.format} currency={currency} />
      </figure>
    </Panel>
  );
}

/** Tabela larga com rolagem horizontal própria (a página nunca rola de lado). */
export function TableFrame({ children, caption, footnote }: { children: ReactNode; caption: string; footnote?: ReactNode }) {
  return (
    <div className="card min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="dash-table">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
      {footnote ? <p className="border-t border-border bg-surface-2/60 px-4 py-2.5 text-[11px] leading-relaxed text-text-3">{footnote}</p> : null}
    </div>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank > 5) return <span className="tabular text-text-3">{rank}</span>;
  const tone = rank === 1 ? "bg-attention-soft text-attention" : rank === 2 ? "bg-primary-soft text-primary" : "bg-info-soft text-info";
  return <span className={cn("tabular inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold", tone)}>#{rank}</span>;
}
