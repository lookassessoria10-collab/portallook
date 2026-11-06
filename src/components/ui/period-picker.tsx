"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { MONTHS_PT, MONTHS_SHORT_PT, formatPeriod, parsePeriodKey, type Period } from "@/lib/dates/period";

export interface PeriodPickerOption {
  key: string;
  label: string;
}

/** Marca exibida sob o mês/semana (ex.: "pendente", "justificado"). */
export interface PeriodPickerMark {
  label: string;
  tone: "attention" | "info" | "positive" | "muted";
}

const MARK_TEXT: Record<PeriodPickerMark["tone"], string> = {
  attention: "text-attention",
  info: "text-info",
  positive: "text-positive",
  muted: "text-text-3",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Item {
  key: string;
  label: string;
  period: Period;
  year: number;
  month: number;
}

/**
 * Escolha de período em etapas: primeiro o ano, depois o mês — e, nas entregas
 * semanais, a semana. Substitui as listas longas de meses de vários anos.
 */
export function PeriodPicker({
  options,
  value,
  onChange,
  marks = {},
  anchorKey,
  disabled,
  idPrefix,
}: {
  /** Períodos permitidos (chaves AAAA-MM ou, nas semanas, AAAA-MM-DD). */
  options: readonly PeriodPickerOption[];
  value: string;
  onChange: (key: string) => void;
  marks?: Record<string, PeriodPickerMark | undefined>;
  /** Período usado para abrir o ano (e o mês) certos quando ainda não há escolha. */
  anchorKey?: string | null;
  disabled?: boolean;
  idPrefix: string;
}) {
  const items = useMemo<Item[]>(
    () =>
      options.flatMap((o) => {
        const period = parsePeriodKey(o.key);
        return period ? [{ key: o.key, label: o.label, period, year: +period.start.slice(0, 4), month: +period.start.slice(5, 7) }] : [];
      }),
    [options],
  );
  const weekly = items.some((i) => i.period.granularity === "week");
  const years = useMemo(() => [...new Set(items.map((i) => i.year))].sort((a, b) => a - b), [items]);
  const selected = items.find((i) => i.key === value) ?? null;
  const anchor = selected ?? items.find((i) => i.key === anchorKey) ?? null;

  const [year, setYear] = useState<number | null>(anchor?.year ?? years.at(-1) ?? null);
  const [month, setMonth] = useState<number | null>(weekly ? (anchor?.month ?? null) : null);

  // Mudança de valor vinda de fora (ex.: outro cliente ou tipo no assistente): abre o ano dele.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (selected) {
      setYear(selected.year);
      if (weekly) setMonth(selected.month);
    }
  }

  const activeYear = year !== null && years.includes(year) ? year : (years.at(-1) ?? null);
  const inYear = items.filter((i) => i.year === activeYear);
  const yearHasAttention = (y: number) => items.some((i) => i.year === y && marks[i.key]?.tone === "attention");
  const weeks = weekly && month !== null ? inYear.filter((i) => i.month === month).sort((a, b) => (a.period.start < b.period.start ? -1 : 1)) : [];

  if (!items.length) return null;

  const cell = (active: boolean, enabled: boolean, shape: "month" | "week" = "month") =>
    cn(
      "flex items-center rounded-[10px] border transition-colors",
      shape === "month" ? "min-h-14 flex-col justify-center gap-0.5 px-1.5 py-1.5 text-center" : "min-h-11 justify-between gap-2 px-3",
      active ? "border-primary bg-primary-soft text-primary" : enabled ? "border-border-strong text-text hover:bg-surface-2" : "cursor-not-allowed border-border text-text-3 opacity-40",
    );

  return (
    <div className="space-y-4">
      <div>
        <p id={`${idPrefix}-year`} className="mb-1.5 text-[13px] font-semibold text-text-2">
          Ano
        </p>
        <div role="radiogroup" aria-labelledby={`${idPrefix}-year`} className="inline-flex max-w-full flex-wrap gap-1 rounded-[12px] border border-border bg-surface-2 p-1">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={y === activeYear}
              disabled={disabled}
              onClick={() => {
                setYear(y);
                if (weekly) setMonth(null);
              }}
              className={cn(
                "tabular relative flex h-9 min-w-16 items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-sm font-bold transition-colors",
                y === activeYear ? "bg-surface text-text shadow-sm" : "text-text-3 hover:text-text-2",
              )}
            >
              {y}
              {yearHasAttention(y) ? (
                <>
                  <span className="size-1.5 rounded-full bg-attention" aria-hidden />
                  <span className="sr-only">(tem período pendente)</span>
                </>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p id={`${idPrefix}-month`} className="mb-1.5 text-[13px] font-semibold text-text-2">
          Mês
        </p>
        <div role="radiogroup" aria-labelledby={`${idPrefix}-month`} className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {MONTHS_SHORT_PT.map((short, i) => {
            const m = i + 1;
            const inMonth = inYear.filter((it) => it.month === m);
            const item = weekly ? null : (inMonth[0] ?? null);
            const enabled = inMonth.length > 0 && !disabled;
            const active = weekly ? month === m : item !== null && item.key === value;
            const mark = weekly ? inMonth.map((it) => marks[it.key]).find(Boolean) : item ? marks[item.key] : undefined;
            return (
              <button
                key={short}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${cap(MONTHS_PT[i])} de ${activeYear}${mark ? ` (${mark.label})` : ""}`}
                disabled={!enabled}
                onClick={() => (weekly ? setMonth(m) : item && onChange(item.key))}
                className={cell(active, enabled)}
              >
                <span className="text-sm font-bold">{cap(short)}</span>
                {mark ? <span className={cn("text-[10.5px] font-semibold leading-none", active ? "text-primary" : MARK_TEXT[mark.tone])}>{mark.label}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {weekly && month !== null ? (
        <div>
          <p id={`${idPrefix}-week`} className="mb-1.5 text-[13px] font-semibold text-text-2">
            Semana
          </p>
          <div role="radiogroup" aria-labelledby={`${idPrefix}-week`} className="grid gap-1.5 sm:grid-cols-2">
            {weeks.map((w) => {
              const mark = marks[w.key];
              const active = w.key === value;
              return (
                <button key={w.key} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => onChange(w.key)} className={cell(active, !disabled, "week")}>
                  <span className="text-sm font-bold">{formatPeriod(w.period, "short")}</span>
                  {mark ? <span className={cn("text-[11px] font-semibold", active ? "text-primary" : MARK_TEXT[mark.tone])}>{mark.label}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="text-[13px] text-text-3" aria-live="polite">
        {selected ? (
          <>
            Selecionado: <strong className="font-semibold text-text">{selected.label}</strong>
            {marks[selected.key] ? ` · ${marks[selected.key]!.label}` : ""}
          </>
        ) : weekly ? (
          "Escolha o ano, o mês e a semana."
        ) : (
          "Escolha o ano e depois o mês."
        )}
      </p>
    </div>
  );
}
