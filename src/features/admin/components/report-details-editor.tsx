"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { saveReportDetailsAction } from "@/features/reports/actions";
import type { Insight, InsightType } from "@/features/reports/schema";

const TYPES: Array<{ value: InsightType; label: string }> = [
  { value: "positive", label: "Resultado positivo" },
  { value: "attention", label: "Ponto de atenção" },
  { value: "recommendation", label: "Recomendação" },
  { value: "neutral", label: "Contexto / neutro" },
];

type Draft = { key: string; id?: string; type: InsightType; title: string; description: string };

export function ReportDetailsEditor({ clientId, reportId, title, allowDownload, insights, hasOriginal }: { clientId: string; reportId: string; title: string | null; allowDownload: boolean; insights: Insight[]; hasOriginal: boolean }) {
  const [t, setT] = useState(title ?? "");
  const [dl, setDl] = useState(allowDownload);
  const [items, setItems] = useState<Draft[]>(insights.map((i) => ({ key: i.id, id: i.id, type: i.type, title: i.title, description: i.description })));
  const [pending, start] = useTransition();
  const router = useRouter();

  const update = (key: string, patch: Partial<Draft>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const save = () =>
    start(async () => {
      const res = await saveReportDetailsAction(clientId, reportId, {
        title: t.trim() || null,
        allowDownload: dl,
        insights: items.filter((i) => i.title.trim()).map((i) => ({ id: i.id, type: i.type, title: i.title, description: i.description })),
      });
      if (res.ok) {
        toast.success(res.message ?? "Salvo.");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="space-y-5">
      <Field label="Título (opcional)" htmlFor="report-title" hint="Aparece em relatórios originais e no histórico.">
        <Input id="report-title" value={t} onChange={(e) => setT(e.target.value)} maxLength={160} placeholder="Ex.: Relatório comercial completo — agosto" />
      </Field>
      {hasOriginal ? <Checkbox checked={dl} onChange={(e) => setDl(e.target.checked)} label="Permitir que o cliente baixe o arquivo original" /> : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Insights da Look ({items.length})</h3>
          <Button size="sm" variant="subtle" onClick={() => setItems((l) => [...l, { key: crypto.randomUUID(), type: "positive", title: "", description: "" }])} disabled={items.length >= 12}>
            <Plus className="size-4" aria-hidden /> Adicionar
          </Button>
        </div>
        {items.length === 0 ? <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-3">Nenhum insight. Textos escritos pela equipe aparecem no portal, identificados por tipo.</p> : null}
        <ul className="space-y-3">
          {items.map((i, idx) => (
            <li key={i.key} className="card-inset space-y-3 p-4">
              <div className="flex items-end gap-2">
                <Field label="Tipo" htmlFor={`type-${i.key}`} className="flex-1">
                  <Select id={`type-${i.key}`} value={i.type} onChange={(e) => update(i.key, { type: e.target.value as InsightType })}>
                    {TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button variant="ghost" size="icon" aria-label={`Remover insight ${idx + 1}`} onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
              <Field label="Título" htmlFor={`title-${i.key}`}>
                <Input id={`title-${i.key}`} value={i.title} maxLength={140} onChange={(e) => update(i.key, { title: e.target.value })} />
              </Field>
              <Field label="Descrição" htmlFor={`desc-${i.key}`} optional>
                <Textarea id={`desc-${i.key}`} value={i.description} maxLength={1500} rows={3} onChange={(e) => update(i.key, { description: e.target.value })} />
              </Field>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={save} disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
