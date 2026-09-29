"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { slugify } from "@/lib/ids";
import { WEEKDAYS_PT } from "@/lib/dates/period";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ClientFormState } from "@/features/clients/actions";

export interface ClientFormValues {
  name: string;
  shortName: string;
  slug: string;
  greetingName: string;
  segment: string;
  currency: string;
  notes: string;
  roiMetric: "roas" | "roiPercent";
  commercial: { enabled: boolean; cadence: "monthly" | "weekly"; dueDay: number; allowOriginalDownload: boolean };
  traffic: { enabled: boolean; cadence: "monthly" | "weekly"; dueDay: number; allowOriginalDownload: boolean };
}

export const DEFAULT_CLIENT_VALUES: ClientFormValues = {
  name: "",
  shortName: "",
  slug: "",
  greetingName: "",
  segment: "",
  currency: "BRL",
  notes: "",
  roiMetric: "roas",
  commercial: { enabled: true, cadence: "monthly", dueDay: 5, allowOriginalDownload: true },
  traffic: { enabled: true, cadence: "weekly", dueDay: 1, allowOriginalDownload: false },
};

export function ClientForm({
  action,
  initial = DEFAULT_CLIENT_VALUES,
  submitLabel,
  isEdit,
}: {
  action: (prev: ClientFormState, form: FormData) => Promise<ClientFormState>;
  initial?: ClientFormValues;
  submitLabel: string;
  isEdit?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(isEdit ?? false);
  const e = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) toast.success("Alterações salvas.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <fieldset className="card space-y-5 p-5 sm:p-6">
        <legend className="sr-only">Identificação</legend>
        <h2 className="text-base font-bold text-text">Identificação</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nome do cliente" htmlFor="name" error={e.name}>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(ev) => {
                setName(ev.target.value);
                if (!slugTouched) setSlug(slugify(ev.target.value));
              }}
              placeholder="Ex.: Dra. Isabor Sant'Anna"
              aria-invalid={e.name ? true : undefined}
            />
          </Field>
          <Field label="Nome curto" htmlFor="shortName" hint="Usado em listas e no título do portal." error={e.shortName}>
            <Input id="shortName" name="shortName" defaultValue={initial.shortName} placeholder="Ex.: Dra. Isabor" />
          </Field>
          <Field
            label="Endereço (slug)"
            htmlFor="slug"
            hint={isEdit ? "Atenção: alterar o endereço muda o link do cliente." : "Parte do link: /c/endereco/…"}
            error={e.slug}
          >
            <Input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(ev) => {
                setSlugTouched(true);
                setSlug(ev.target.value.toLowerCase());
              }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              aria-invalid={e.slug ? true : undefined}
            />
          </Field>
          <Field label="Nome na saudação" htmlFor="greetingName" hint={'Aparece como "Olá, …" no portal.'} optional>
            <Input id="greetingName" name="greetingName" defaultValue={initial.greetingName} placeholder="Ex.: Isabor" />
          </Field>
          <Field label="Segmento" htmlFor="segment" optional>
            <Input id="segment" name="segment" defaultValue={initial.segment} placeholder="Ex.: Gastroenterologia" />
          </Field>
          <Field label="Moeda" htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={initial.currency}>
              <option value="BRL">Real (BRL)</option>
              <option value="USD">Dólar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleFieldset prefix="commercial" title="Comercial" description="Funil, canais, receita e investimento." initial={initial.commercial} />
        <ModuleFieldset prefix="traffic" title="Tráfego" description="Campanhas Meta Ads, Google Ads e outras." initial={initial.traffic} />
      </div>

      <fieldset className="card space-y-5 p-5 sm:p-6">
        <legend className="sr-only">Dashboard e observações</legend>
        <h2 className="text-base font-bold text-text">Dashboard e observações</h2>
        <Field label="Indicador de retorno em destaque" htmlFor="roiMetric" hint="Como o retorno aparece no resumo comercial do cliente.">
          <Select id="roiMetric" name="roiMetric" defaultValue={initial.roiMetric}>
            <option value="roas">ROAS (ex.: 3,2x — receita ÷ investimento)</option>
            <option value="roiPercent">Retorno percentual (ex.: +220%)</option>
          </Select>
        </Field>
        <Field label="Observações internas" htmlFor="notes" hint="Visível apenas para a equipe Look." optional>
          <Textarea id="notes" name="notes" defaultValue={initial.notes} rows={3} />
        </Field>
      </fieldset>

      {state.error ? (
        <p className="rounded-xl bg-negative-soft px-4 py-3 text-sm font-medium text-negative" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

function ModuleFieldset({ prefix, title, description, initial }: { prefix: "commercial" | "traffic"; title: string; description: string; initial: ClientFormValues["commercial"] }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [cadence, setCadence] = useState(initial.cadence);
  const [dueDay, setDueDay] = useState(initial.dueDay);
  const days = cadence === "weekly" ? WEEKDAYS_PT.map((d, i) => ({ value: i + 1, label: d.charAt(0).toUpperCase() + d.slice(1) })) : Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: `Dia ${i + 1}` }));
  return (
    <fieldset className="card space-y-4 p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <Checkbox name={`${prefix}.enabled`} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} label={`Módulo ${title}`} description={description} />
      <div className={enabled ? "grid gap-4 sm:grid-cols-2" : "pointer-events-none grid gap-4 opacity-45 sm:grid-cols-2"} aria-disabled={!enabled}>
        <Field label="Periodicidade" htmlFor={`${prefix}-cadence`}>
          <Select
            id={`${prefix}-cadence`}
            name={`${prefix}.cadence`}
            value={cadence}
            onChange={(e) => {
              const next = e.target.value as "monthly" | "weekly";
              setCadence(next);
              setDueDay(next === "weekly" ? 1 : 5);
            }}
          >
            <option value="monthly">Mensal</option>
            <option value="weekly">Semanal</option>
          </Select>
        </Field>
        <Field label={cadence === "weekly" ? "Entrega até (dia da semana seguinte)" : "Entrega até (dia do mês seguinte)"} htmlFor={`${prefix}-due`}>
          <Select id={`${prefix}-due`} name={`${prefix}.dueDay`} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}>
            {days.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Checkbox name={`${prefix}.allowOriginalDownload`} defaultChecked={initial.allowOriginalDownload} label="Permitir download dos originais" description="Valor padrão para novos relatórios; pode ser alterado em cada um." />
    </fieldset>
  );
}
