"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS_PT } from "@/lib/dates/period";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE, type ContentStatus } from "@/features/content/schema";
import type { PortalContentItem, PortalContentVM } from "@/features/content/view-model";

const WEEKDAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const WD_SHORT = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const DAY = 86_400_000;

const parts = (iso: string) => ({ y: +iso.slice(0, 4), m: +iso.slice(5, 7), d: +iso.slice(8, 10) });
const utc = (iso: string) => Date.UTC(parts(iso).y, parts(iso).m - 1, parts(iso).d);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** 0 = segunda … 6 = domingo. */
const weekday = (iso: string) => (new Date(utc(iso)).getUTCDay() + 6) % 7;
const pad = (n: number) => String(n).padStart(2, "0");
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const longDate = (iso: string) => `${WEEKDAYS[weekday(iso)]}, ${parts(iso).d} de ${MONTHS_PT[parts(iso).m - 1]} de ${parts(iso).y}`;
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${a})`;
};

type View = "auto" | "month" | "list";

/**
 * Área "Conteúdo" do portal: calendário do mês no computador, agenda por semana no celular
 * e o detalhe de cada post. Recebe só o que o cliente pode ver (sem notas internas).
 */
export function ContentCalendar({ vm }: { vm: PortalContentVM }) {
  const { items, months, today } = vm;
  const [monthIdx, setMonthIdx] = useState(() => Math.max(0, months.findIndex((m) => m.key === vm.defaultMonth)));
  const [view, setView] = useState<View>("auto");
  const [fmt, setFmt] = useState<string>("all");
  const [onlyAwaiting, setOnlyAwaiting] = useState(false);
  const [selId, setSelId] = useState(() => (items.find((i) => i.date >= today) ?? items[items.length - 1]).id);
  const [sheet, setSheet] = useState(false);

  const month = months[monthIdx];
  const monthItems = useMemo(() => items.filter((i) => i.date.startsWith(month.key)), [items, month.key]);
  const awaitingAll = useMemo(() => items.filter((i) => i.status === "awaiting"), [items]);
  const base = onlyAwaiting ? awaitingAll : monthItems;
  const shown = fmt === "all" ? base : base.filter((i) => i.format === fmt);
  const selected = items.find((i) => i.id === selId) ?? items[0];
  const upcoming = items.filter((i) => i.date >= today).slice(0, 5);

  const formats = useMemo(() => {
    const map = new Map<string, { label: string; color: string; count: number }>();
    for (const i of base) map.set(i.format, { label: i.format, color: i.formatColor, count: (map.get(i.format)?.count ?? 0) + 1 });
    return [...map.values()];
  }, [base]);

  const count = (s: ContentStatus) => monthItems.filter((i) => i.status === s).length;

  const pick = (item: PortalContentItem) => {
    setSelId(item.id);
    const idx = months.findIndex((m) => item.date.startsWith(m.key));
    if (idx >= 0 && !onlyAwaiting) setMonthIdx(idx);
    // Sem o painel lateral (abaixo de 1280 px), o detalhe abre numa janela.
    if (window.matchMedia("(max-width: 1279px)").matches) setSheet(true);
  };

  const goMonth = (delta: number) => {
    setMonthIdx((i) => Math.min(months.length - 1, Math.max(0, i + delta)));
    setFmt("all");
    setOnlyAwaiting(false);
  };

  // Calendário do mês: semanas de segunda a domingo.
  const weeks = useMemo(() => {
    const first = `${month.key}-01`;
    const lead = weekday(first);
    const lastDay = new Date(Date.UTC(+month.key.slice(0, 4), +month.key.slice(5, 7), 0)).getUTCDate();
    const cells = Math.ceil((lead + lastDay) / 7) * 7;
    const out: Array<Array<{ iso: string; inMonth: boolean; items: PortalContentItem[] }>> = [];
    for (let i = 0; i < cells; i++) {
      const iso = isoOf(utc(first) + (i - lead) * DAY);
      if (i % 7 === 0) out.push([]);
      const inMonth = iso.startsWith(month.key);
      out[out.length - 1].push({ iso, inMonth, items: inMonth ? shown.filter((x) => x.date === iso) : [] });
    }
    return out;
  }, [month.key, shown]);

  // Agenda: semanas com conteúdo.
  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; past: boolean; items: PortalContentItem[] }> = [];
    for (const item of shown) {
      const start = isoOf(utc(item.date) - weekday(item.date) * DAY);
      let g = out.find((x) => x.key === start);
      if (!g) {
        const end = isoOf(utc(start) + 6 * DAY);
        const current = today >= start && today <= end;
        g = { key: start, label: `${current ? "Esta semana" : "Semana"} · ${shortDate(start)} a ${shortDate(end)}`, past: end < today, items: [] };
        out.push(g);
      }
      g.items.push(item);
    }
    return out;
  }, [shown, today]);
  const [showPast, setShowPast] = useState(false);
  // No mês atual, a agenda abre nesta semana; as que já passaram ficam atrás de um botão.
  const pastWeeks = !onlyAwaiting && !showPast && groups.some((g) => !g.past) ? groups.filter((g) => g.past).length : 0;
  const agenda = pastWeeks ? groups.filter((g) => !g.past) : groups;

  const viewBtn = (v: Exclude<View, "auto">) =>
    cn(
      "h-9 rounded-[10px] px-4 text-sm font-bold transition-colors",
      view === v ? "bg-surface-3 text-text" : view === "auto" ? (v === "month" ? "text-text-3 md:bg-surface-3 md:text-text" : "bg-surface-3 text-text md:bg-transparent md:text-text-3") : "text-text-3 hover:text-text-2",
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-[14px] border border-border bg-surface p-1">
          <button type="button" onClick={() => goMonth(-1)} disabled={monthIdx === 0 || onlyAwaiting} aria-label="Mês anterior" className="grid size-9 place-items-center rounded-[10px] text-text-2 hover:bg-surface-2 disabled:opacity-35">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="min-w-[150px] text-center text-sm font-bold text-text sm:min-w-[170px]">{onlyAwaiting ? "Aguardando aprovação" : month.label}</span>
          <button type="button" onClick={() => goMonth(1)} disabled={monthIdx === months.length - 1 || onlyAwaiting} aria-label="Próximo mês" className="grid size-9 place-items-center rounded-[10px] text-text-2 hover:bg-surface-2 disabled:opacity-35">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <div role="group" aria-label="Visualização" className="grid grid-cols-2 gap-1 rounded-[14px] border border-border bg-surface p-1">
          <button type="button" onClick={() => setView("month")} aria-pressed={view === "auto" ? undefined : view === "month"} className={viewBtn("month")}>
            Mês
          </button>
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "auto" ? undefined : view === "list"} className={viewBtn("list")}>
            Agenda
          </button>
        </div>
      </div>

      <section aria-label="Resumo do mês" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Conteúdos no mês" value={monthItems.length} hint={monthItems.length ? `Planejados para ${MONTHS_PT[+month.key.slice(5, 7) - 1]}` : "Nada planejado neste mês"} highlight />
        <Kpi label="Aguardam sua aprovação" value={count("awaiting")} hint="Revise e responda à equipe da Look" tone={count("awaiting") ? "attention" : undefined} />
        <Kpi label="Aprovados" value={count("approved")} hint="Prontos para publicar" />
        <Kpi label="Publicados" value={count("published")} hint="Já no ar" tone="positive" />
      </section>

      {awaitingAll.length ? (
        <button
          type="button"
          onClick={() => {
            setOnlyAwaiting((v) => !v);
            setFmt("all");
          }}
          aria-pressed={onlyAwaiting}
          className="flex w-full items-center gap-3 rounded-[14px] border border-[rgb(246_189_91/0.3)] bg-attention-soft px-4 py-3 text-left text-sm text-text hover:brightness-110"
        >
          <span className="size-2.5 shrink-0 rounded-full bg-attention shadow-[0_0_0_4px_rgb(246_189_91/0.2)]" aria-hidden />
          <span className="min-w-0 flex-1">
            <strong className="font-bold">{awaitingAll.length === 1 ? "1 conteúdo aguarda a sua aprovação" : `${awaitingAll.length} conteúdos aguardam a sua aprovação`}</strong>
            <span className="text-text-2"> · aparecem marcados em amarelo no calendário.</span>
          </span>
          <span className="shrink-0 text-[13px] font-bold text-attention">{onlyAwaiting ? "Mostrar todos" : "Ver só esses"}</span>
        </button>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Calendário de conteúdos" className="min-w-0 space-y-3.5">
          {formats.length > 1 ? (
            <div role="group" aria-label="Filtrar por formato" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <FormatChip active={fmt === "all"} onClick={() => setFmt("all")} label="Todos" count={base.length} color="#eaf1fa" />
              {formats.map((f) => (
                <FormatChip key={f.label} active={fmt === f.label} onClick={() => setFmt(f.label)} label={f.label} count={f.count} color={f.color} />
              ))}
            </div>
          ) : null}

          <div className={cn(view === "list" || onlyAwaiting ? "hidden" : view === "auto" ? "hidden md:block" : "block")}>
            <div className="overflow-x-auto">
              <div className="min-w-[720px] space-y-1.5">
                <div className="grid grid-cols-7 gap-1.5">
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                    <span key={d} className="px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
                      {d}
                    </span>
                  ))}
                </div>
                {weeks.map((week) => (
                  <div key={week[0].iso} className="grid grid-cols-7 gap-1.5">
                    {week.map((day) => {
                      const isToday = day.iso === today;
                      return (
                        <div
                          key={day.iso}
                          className={cn(
                            "flex min-h-28 min-w-0 flex-col gap-1.5 rounded-[12px] border p-2",
                            day.inMonth ? "bg-surface" : "border-[rgb(148_176_214/0.05)]",
                            isToday ? "border-[rgb(34_181_242/0.6)]" : day.inMonth ? "border-border" : "",
                          )}
                        >
                          <span className={cn("tabular grid h-6 min-w-6 place-items-center self-start rounded-full px-1.5 text-xs font-bold", isToday ? "bg-primary text-on-primary" : day.inMonth ? "text-text-2" : "text-[#3a4c68]")}>
                            {parts(day.iso).d}
                          </span>
                          {day.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => pick(item)}
                              aria-pressed={item.id === selected.id}
                              aria-label={`${item.title} · ${item.format} · ${CONTENT_STATUS_LABEL[item.status]}`}
                              className="flex min-h-7 w-full items-center gap-1.5 rounded-[8px] border px-1.5 py-1 text-left text-xs font-semibold text-text"
                              style={{ background: alpha(item.formatColor, item.id === selected.id ? 0.3 : 0.14), borderColor: item.id === selected.id ? "var(--primary)" : "rgb(148 176 214 / 0.12)" }}
                            >
                              <span className="size-[7px] shrink-0 rounded-full" style={{ background: item.formatColor }} aria-hidden />
                              <span className={cn("line-clamp-2 min-w-0 flex-1 leading-tight", item.status === "published" && "opacity-80")}>{item.title}</span>
                              {item.status === "awaiting" ? <span className="size-[7px] shrink-0 rounded-full bg-attention shadow-[0_0_0_3px_rgb(246_189_91/0.2)]" aria-hidden /> : null}
                              {item.status === "published" ? <Check className="size-3 shrink-0 text-positive" strokeWidth={3} aria-hidden /> : null}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={cn(view === "month" && !onlyAwaiting ? "hidden" : view === "auto" && !onlyAwaiting ? "md:hidden" : "block", "space-y-6")}>
            {pastWeeks ? (
              <button type="button" onClick={() => setShowPast(true)} className="flex h-11 w-full items-center justify-center rounded-[12px] border border-border-strong text-[13px] font-bold text-text-2 hover:bg-surface-2">
                {pastWeeks === 1 ? "Mostrar a semana anterior" : `Mostrar ${pastWeeks} semanas anteriores`}
              </button>
            ) : null}
            {agenda.length ? (
              agenda.map((g) => (
                <section key={g.key} aria-label={g.label} className="space-y-2">
                  <h3 className="dash-label">{g.label}</h3>
                  {g.items.map((item) => (
                    <AgendaRow key={item.id} item={item} today={today} selected={item.id === selected.id} onPick={() => pick(item)} />
                  ))}
                </section>
              ))
            ) : (
              <p className="rounded-[14px] border border-dashed border-border-strong px-6 py-10 text-center text-sm text-text-3">Nenhum conteúdo com esse filtro neste mês.</p>
            )}
          </div>
        </section>

        <aside aria-label="Detalhes do conteúdo" className="hidden space-y-4 xl:sticky xl:top-24 xl:block xl:self-start">
          <section className="card space-y-4 p-5">
            <p className="eyebrow">Conteúdo selecionado</p>
            <ContentDetail item={selected} />
          </section>
          {upcoming.length ? (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold text-text">Próximos conteúdos</h2>
              <ul className="mt-2">
                {upcoming.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => pick(item)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-surface-2">
                      <span className="tabular w-11 shrink-0 text-xs font-bold text-text-2">{shortDate(item.date)}</span>
                      <span className="size-2 shrink-0 rounded-full" style={{ background: item.formatColor }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{item.title}</span>
                      <span className="shrink-0 text-[11px] text-text-3">{item.format}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {sheet ? (
        <Dialog open onClose={() => setSheet(false)} title={selected.title} size="lg" footer={<button type="button" onClick={() => setSheet(false)} className="h-11 rounded-[10px] border border-border-strong px-4 text-sm font-bold text-text hover:bg-surface-2">Voltar para a agenda</button>}>
          <ContentDetail item={selected} hideTitle />
        </Dialog>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, hint, highlight, tone }: { label: string; value: number; hint: string; highlight?: boolean; tone?: "attention" | "positive" }) {
  return (
    <article className={cn("card flex min-w-0 flex-col gap-2 p-4 sm:p-5", highlight && "border-[rgb(0_174_239/0.3)] bg-[linear-gradient(135deg,rgb(0_174_239/0.12),transparent_70%)]", tone === "attention" && "border-[rgb(246_189_91/0.35)]")}>
      <h3 className="text-[13px] font-semibold leading-snug text-text-2">{label}</h3>
      <p className={cn("tabular text-[1.75rem] font-bold leading-none tracking-tight text-text", tone === "attention" && "text-attention", tone === "positive" && "text-positive")}>{value}</p>
      <p className="text-xs text-text-3">{hint}</p>
    </article>
  );
}

function FormatChip({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors", active ? "border-transparent bg-primary text-on-primary" : "border-border-strong text-text-2 hover:bg-surface-2 hover:text-text")}
    >
      <span className="size-2 rounded-full" style={{ background: active ? "currentColor" : color }} aria-hidden />
      {label}
      <span className="tabular text-[11px] font-bold opacity-75">{count}</span>
    </button>
  );
}

function AgendaRow({ item, today, selected, onPick }: { item: PortalContentItem; today: string; selected: boolean; onPick: () => void }) {
  const isToday = item.date === today;
  return (
    <button type="button" onClick={onPick} aria-pressed={selected} className={cn("flex w-full items-stretch gap-3 rounded-[14px] border bg-surface p-3 text-left text-text", isToday || selected ? "border-[rgb(34_181_242/0.45)]" : "border-border")}>
      <span className="flex w-10 shrink-0 flex-col items-center gap-0.5">
        <span className={cn("text-[10px] font-bold uppercase tracking-[0.12em]", isToday ? "text-primary" : "text-text-3")}>{isToday ? "Hoje" : WD_SHORT[weekday(item.date)]}</span>
        <span className="tabular text-xl font-bold">{pad(parts(item.date).d)}</span>
      </span>
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: item.formatColor }} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[15px] font-bold leading-snug">{item.title}</span>
        <span className="text-xs text-text-3">{[item.format, item.channel, item.time].filter(Boolean).join(" · ")}</span>
        <Badge tone={CONTENT_STATUS_TONE[item.status]} className="self-start">
          {CONTENT_STATUS_LABEL[item.status]}
        </Badge>
      </span>
      <ChevronRight className="size-4 shrink-0 self-center text-text-3 xl:hidden" aria-hidden />
    </button>
  );
}

function ContentDetail({ item, hideTitle }: { item: PortalContentItem; hideTitle?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-text" style={{ background: alpha(item.formatColor, 0.18) }}>
          <span className="size-[7px] rounded-full" style={{ background: item.formatColor }} aria-hidden />
          {item.format}
        </span>
        {item.channel ? <Badge tone="muted">{item.channel}</Badge> : null}
        <Badge tone={CONTENT_STATUS_TONE[item.status]}>{CONTENT_STATUS_LABEL[item.status]}</Badge>
      </div>
      <div>
        {hideTitle ? null : <h2 className="text-xl font-bold leading-tight text-text">{item.title}</h2>}
        <p className={cn("flex items-center gap-2 text-[13px] text-text-2", !hideTitle && "mt-1.5")}>
          <CalendarDays className="size-4 shrink-0 text-text-3" aria-hidden />
          {longDate(item.date)}
          {item.time ? ` · ${item.time}` : ""}
        </p>
      </div>
      <div>
        <h3 className="mb-1.5 text-[13px] font-bold text-text">Legenda</h3>
        {item.caption ? (
          <p className="max-h-72 overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-text-2">{item.caption}</p>
        ) : (
          <p className="text-[13px] text-text-3">Legenda em produção pela equipe da Look.</p>
        )}
      </div>
      {item.description ? (
        <div>
          <h3 className="mb-1.5 text-[13px] font-bold text-text">Texto do conteúdo</h3>
          <p className="max-h-60 overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-text-2">{item.description}</p>
        </div>
      ) : null}
      {item.status === "awaiting" ? (
        <p className="rounded-[10px] bg-attention-soft px-3 py-2.5 text-[13px] leading-relaxed text-attention">Este conteúdo aguarda a sua aprovação. Responda à equipe da Look pelo canal de sempre.</p>
      ) : null}
    </div>
  );
}
