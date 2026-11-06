"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { formatPeriod, parsePeriodKey } from "@/lib/dates/period";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/confirm-action";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { PeriodPicker, type PeriodPickerMark, type PeriodPickerOption } from "@/components/ui/period-picker";
import type { ReportType } from "@/features/reports/schema";
import { deletePeriodNoteAction, savePeriodNoteAction } from "../actions";
import { PERIOD_NOTE_PRESETS, PERIOD_NOTE_STATUS_LABEL, PERIOD_NOTE_STATUS_TONE as NOTE_STATUS_TONE, PERIOD_NOTE_TEXT_MAX, notePresetsFor, type PeriodNote, type PeriodNoteStatus } from "../schema";

const monthLabel = (key: string) => {
  const p = parsePeriodKey(key);
  return p ? formatPeriod(p) : key;
};


const STATUS_CHOICES: Array<{ value: PeriodNoteStatus; hint: string }> = [
  { value: "no_data", hint: "O mês aparece no portal só com esta justificativa." },
  { value: "partial", hint: "O relatório do mês aparece com esta justificativa como aviso." },
];

/**
 * Justificativas da área (aba Comercial, Tráfego…): meses sem dados ou com dados
 * incompletos. O cliente vê o mês e o texto no portal.
 */
export function PeriodNotesCard({
  clientId,
  type,
  notes,
  options,
  reportKeys,
  anchorKey,
}: {
  clientId: string;
  type: ReportType;
  notes: PeriodNote[];
  /** Meses que podem receber justificativa (AAAA-MM, mais recentes primeiro). */
  options: PeriodPickerOption[];
  /** Meses que já têm relatório nesta área. */
  reportKeys: string[];
  /** Mês aberto no seletor ao criar (o período esperado). */
  anchorKey: string | null;
}) {
  const [editing, setEditing] = useState<PeriodNote | "new" | null>(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <Card>
      <CardHeader
        title="Justificativas"
        subtitle="Meses sem dados ou com dados incompletos"
        icon={<MessageSquareText className="size-4" />}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> Adicionar
          </Button>
        }
      />
      <CardBody>
        {notes.length ? (
          <ul className="divide-y divide-border">
            {notes.map((n) => (
              <li key={n.periodKey} className="flex items-start gap-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-text">{monthLabel(n.periodKey)}</span>
                    <Badge tone={NOTE_STATUS_TONE[n.status]}>{PERIOD_NOTE_STATUS_LABEL[n.status]}</Badge>
                  </p>
                  <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-text-2">{n.text}</p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(n)} aria-label={`Editar justificativa de ${monthLabel(n.periodKey)}`} title="Editar">
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                   
                    icon={<Trash2 className="size-4" aria-hidden />}
                    ariaLabel={`Remover justificativa de ${monthLabel(n.periodKey)}`}
                    action={() => deletePeriodNoteAction(clientId, type, n.periodKey)}
                    confirm={{
                      title: "Remover justificativa?",
                      description: `O cliente deixa de ver a justificativa de ${monthLabel(n.periodKey).toLowerCase()} no portal. Os relatórios do mês não são alterados.`,
                      confirmLabel: "Remover",
                      tone: "danger",
                    }}
                  >
                    {null}
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] leading-relaxed text-text-3">
            Use quando um mês ficar sem relatório ou com dados incompletos. O cliente vê o mês e a justificativa no portal, nesta mesma área.
          </p>
        )}
      </CardBody>
      {editing ? (
        <PeriodNoteDialog
          key={editing === "new" ? "new" : editing.periodKey}
          clientId={clientId}
          type={type}
          initial={editing === "new" ? null : editing}
          notes={notes}
          options={options}
          reportKeys={reportKeys}
          anchorKey={anchorKey}
          onClose={close}
        />
      ) : null}
    </Card>
  );
}

function PeriodNoteDialog({
  clientId,
  type,
  initial,
  notes,
  options,
  reportKeys,
  anchorKey,
  onClose,
}: {
  clientId: string;
  type: ReportType;
  initial: PeriodNote | null;
  notes: PeriodNote[];
  options: PeriodPickerOption[];
  reportKeys: string[];
  anchorKey: string | null;
  onClose: () => void;
}) {
  const [periodKey, setPeriodKey] = useState(initial?.periodKey ?? "");
  const [status, setStatus] = useState<PeriodNoteStatus>(initial?.status ?? "no_data");
  const [text, setText] = useState(initial?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const presets = notePresetsFor(type, status);
  const presetId = presets.find((p) => p.text === text.trim())?.id ?? "";
  // Mês já usado em outra justificativa (salvar substitui aquela).
  const replacing = periodKey && periodKey !== initial?.periodKey ? notes.find((n) => n.periodKey === periodKey) : undefined;
  const hasReport = reportKeys.includes(periodKey);
  const list = initial && !options.some((o) => o.key === initial.periodKey) ? [{ key: initial.periodKey, label: monthLabel(initial.periodKey) }, ...options] : options;

  const marks: Record<string, PeriodPickerMark> = {};
  for (const k of reportKeys) marks[k] = { label: "com dados", tone: "positive" };
  for (const n of notes) marks[n.periodKey] = { label: "justificado", tone: "info" };

  const changeStatus = (next: PeriodNoteStatus) => {
    setStatus(next);
    // Texto pronto do outro tipo não serve mais: o campo volta vazio para escolher outro.
    if (PERIOD_NOTE_PRESETS.some((p) => p.status !== next && p.text === text.trim())) setText("");
  };

  const save = () =>
    start(async () => {
      setError(null);
      const res = await savePeriodNoteAction(clientId, { type, periodKey, status, text, replaceKey: initial?.periodKey ?? null });
      if (!res.ok) return setError(res.error);
      toast.success(res.message ?? "Justificativa salva.");
      onClose();
      router.refresh();
    });

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={initial ? "Editar justificativa" : "Nova justificativa"}
      description="Explique ao cliente por que o mês está sem dados ou com dados incompletos. O texto aparece no portal, no mês escolhido."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={pending || !periodKey || !text.trim()} aria-busy={pending}>
            {pending ? "Salvando…" : "Salvar justificativa"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <PeriodPicker idPrefix={`note-${type}`} options={list} value={periodKey} onChange={setPeriodKey} marks={marks} anchorKey={initial?.periodKey ?? anchorKey} disabled={pending} />
        {replacing ? (
          <p className="flex items-start gap-2 rounded-xl bg-attention-soft px-3.5 py-2.5 text-[13px] text-text-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
            {monthLabel(periodKey)} já tem uma justificativa. Ao salvar, ela será substituída por esta.
          </p>
        ) : null}

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-text-2">Situação do mês</legend>
          <div role="radiogroup" aria-label="Situação do mês" className="grid gap-2 sm:grid-cols-2">
            {STATUS_CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={status === c.value}
                disabled={pending}
                onClick={() => changeStatus(c.value)}
                className={cn("rounded-[var(--radius-md)] border p-3.5 text-left transition-colors", status === c.value ? "border-primary bg-primary-soft" : "border-border-strong hover:bg-surface-2")}
              >
                <span className="block text-sm font-bold text-text">{PERIOD_NOTE_STATUS_LABEL[c.value]}</span>
                <span className="mt-0.5 block text-xs text-text-3">{c.hint}</span>
              </button>
            ))}
          </div>
          {periodKey && status === "no_data" && hasReport ? (
            <p className="mt-2 text-xs text-text-3">Este mês já tem relatório: o cliente vê o relatório com a justificativa como aviso.</p>
          ) : periodKey && status === "partial" && !hasReport ? (
            <p className="mt-2 text-xs text-text-3">Este mês ainda não tem relatório: até ele ser publicado, o cliente vê só a justificativa.</p>
          ) : null}
        </fieldset>

        <Field label="Texto pronto" htmlFor={`note-${type}-preset`} optional hint="Escolha um texto e ajuste no campo abaixo, se precisar.">
          <Select
            id={`note-${type}-preset`}
            value={presetId}
            disabled={pending}
            onChange={(e) => {
              const p = presets.find((x) => x.id === e.target.value);
              if (p) setText(p.text);
            }}
          >
            <option value="">{text.trim() ? "Texto personalizado" : "Escolha um texto pronto…"}</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Justificativa que o cliente vê" htmlFor={`note-${type}-text`} hint={`${text.length}/${PERIOD_NOTE_TEXT_MAX} caracteres`}>
          <Textarea id={`note-${type}-text`} value={text} onChange={(e) => setText(e.target.value)} maxLength={PERIOD_NOTE_TEXT_MAX} rows={4} disabled={pending} placeholder="Ex.: As campanhas ficaram pausadas durante todo o mês, por isso não há resultados de tráfego pago." />
        </Field>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl bg-negative-soft px-3.5 py-2.5 text-sm font-medium text-negative" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
