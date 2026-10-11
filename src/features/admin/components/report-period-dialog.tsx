"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { changeReportPeriodAction } from "@/features/reports/actions";
import { importFromReportAction } from "@/features/uploads/actions";
import type { PeriodOption } from "@/features/uploads/period-options";

/**
 * Corrige o período de um relatório já importado — ex.: planilha enviada com as
 * datas de outro mês, que fez o relatório entrar no período errado. Quando o
 * relatório guarda a planilha original, também permite importar outros meses dela.
 */
export function ReportPeriodDialog({
  clientId,
  reportId,
  current,
  options,
  published,
  sourceFileName,
}: {
  clientId: string;
  reportId: string;
  current: PeriodOption;
  options: PeriodOption[];
  published: boolean;
  /** Planilha original guardada no relatório (null = sem planilha para reabrir). */
  sourceFileName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(current.key);
  const [pending, start] = useTransition();
  const router = useRouter();
  const list = options.some((o) => o.key === current.key) ? options : [current, ...options];
  const target = list.find((o) => o.key === key);

  const close = () => {
    setKey(current.key);
    setOpen(false);
  };

  const save = () =>
    start(async () => {
      const res = await changeReportPeriodAction(clientId, reportId, key);
      if (res.ok) {
        toast.success(res.message ?? "Período alterado.");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });

  const importMonths = () =>
    start(async () => {
      const res = await importFromReportAction(clientId, reportId);
      if (res.ok) router.push(`/adm/uploads/${res.data.importId}`);
      else toast.error(res.error);
    });

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <CalendarRange className="size-4" aria-hidden /> Corrigir período
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Corrigir período"
        size="sm"
        description={
          <>
            Use quando o relatório entrou no mês errado (ex.: planilha com as datas de outro período). Os dados continuam os mesmos; muda só o período em que ele aparece.
            {published ? " Por estar publicado, o cliente passa a vê-lo no novo período." : ""}
          </>
        }
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} disabled={pending || key === current.key} aria-busy={pending}>
              {pending ? "Salvando…" : target && key !== current.key ? `Mover para ${target.label}` : "Mover"}
            </Button>
          </>
        }
      >
        <Field label="Período correto" htmlFor={`period-${reportId}`} hint={`Atual: ${current.label}`}>
          <Select id={`period-${reportId}`} value={key} onChange={(e) => setKey(e.target.value)} disabled={pending}>
            {list.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
                {o.key === current.key ? " (atual)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {sourceFileName ? (
          <div className="mt-5 rounded-xl border border-border bg-surface-2/60 p-3.5">
            <p className="text-sm font-bold text-text">A planilha tem outros meses?</p>
            <p className="mt-0.5 text-[13px] leading-snug text-text-3">
              Abra a mesma planilha (<span className="break-all">{sourceFileName}</span>) e escolha os meses que também devem entrar. Cada mês vira um rascunho; este relatório continua como está.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={importMonths} disabled={pending}>
              <CalendarPlus className="size-4" aria-hidden /> Escolher meses da planilha
            </Button>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
