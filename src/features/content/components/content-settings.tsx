"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/dates/period";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/confirm-action";
import { Checkbox, Field, Select } from "@/components/ui/field";
import { refreshContentAction, saveContentSettingsAction } from "@/features/content/actions";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE, type ContentRules, type ContentStatus } from "@/features/content/schema";

export interface ContentSettingsProps {
  clientId: string;
  enabled: boolean;
  /** Lista escolhida no painel (null = automática pelo nome). */
  listId: string | null;
  /** Lista em uso agora (automática ou escolhida). */
  current: { id: string; name: string; folder: string | null; space: string | null; auto: boolean; url: string | null } | null;
  /** Lista que o nome do cliente encontraria (mostrada na opção "Automática"). */
  autoName: string | null;
  lists: Array<{ id: string; name: string; folder: string | null; space: string | null }>;
  rules: ContentRules;
  typeOptions: Array<{ value: string; label: string }>;
  sync: { fetchedLabel: string | null; error: string | null; from: string | null; to: string | null };
  preview: { total: number; visible: number; hidden: number; awaiting: number } | null;
  hidden: Array<{ id: string; date: string; name: string; reason: string; url: string | null }>;
  warnings: { pastNotPublished: Array<{ id: string; date: string; name: string }>; noFormat: Array<{ id: string; date: string; name: string }> };
  statusMap: Array<{ status: ContentStatus; sources: Array<{ name: string; color: string | null }> }>;
  previewHref: string;
}

const BACK_OPTIONS = [0, 15, 30, 60, 90];
const AHEAD_OPTIONS = [30, 60, 90, 180];

/** Aba "Conteúdo" do cliente no painel: lista do ClickUp, regras do que o cliente vê e prévia. */
export function ContentSettings(props: ContentSettingsProps) {
  const { clientId, current, lists, typeOptions, preview, hidden, warnings, statusMap } = props;
  const [enabled, setEnabled] = useState(props.enabled);
  const [listChoice, setListChoice] = useState(props.listId ?? "auto");
  const [rules, setRules] = useState<ContentRules>(props.rules);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof ContentRules>(key: K, value: ContentRules[K]) => setRules((r) => ({ ...r, [key]: value }));
  const toggleType = (value: string, on: boolean) => set("types", on ? [...new Set([...rules.types, value])] : rules.types.filter((t) => t !== value));

  const save = () =>
    start(async () => {
      const res = await saveContentSettingsAction(clientId, { enabled, listId: listChoice === "auto" ? null : listChoice, rules });
      if (res.ok) {
        toast.success(res.message ?? "Salvo.");
        router.refresh();
      } else toast.error(res.error);
    });

  const folders = [...new Set(lists.map((l) => l.folder ?? "Sem pasta"))];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <section className="card space-y-4 p-4 sm:p-5 xl:col-span-2" aria-label="Lista do ClickUp">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-text">Lista do ClickUp</h2>
              {current ? <Badge tone="info">{current.auto ? "Vinculada pelo nome" : "Escolhida no painel"}</Badge> : <Badge tone="attention">Nenhuma lista</Badge>}
              {!enabled ? <Badge tone="attention">Escondida do portal</Badge> : null}
            </div>
            {current ? (
              <p className="mt-1.5 text-sm text-text-2">
                <strong className="text-text">{current.name}</strong>
                {[current.space, current.folder].filter(Boolean).length ? ` · ${[current.space, current.folder].filter(Boolean).join(" › ")}` : ""}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-text-3">Nenhuma lista do ClickUp tem o nome deste cliente. Escolha a lista abaixo.</p>
            )}
            {props.sync.fetchedLabel ? (
              <p className="mt-1 text-[13px] text-text-3">
                Lida em {props.sync.fetchedLabel} · o portal busca de novo a cada 10 minutos
                {props.sync.from && props.sync.to ? ` · período ${formatDate(props.sync.from)} a ${formatDate(props.sync.to)}` : ""}
              </p>
            ) : null}
            {props.sync.error ? <p className="mt-2 rounded-[10px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{props.sync.error}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton action={() => refreshContentAction(clientId)} variant="primary" size="sm" icon={<RefreshCw className="size-4" aria-hidden />}>
              Atualizar agora
            </ActionButton>
            {current?.url ? (
              <a href={current.url} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
                <ExternalLink className="size-4" aria-hidden /> Abrir no ClickUp
              </a>
            ) : null}
            {preview?.visible ? (
              <Link href={props.previewHref} className={buttonClass("ghost", "sm")}>
                <Eye className="size-4" aria-hidden /> Prévia no portal
              </Link>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
          <Field label="Lista usada" htmlFor="content-list" hint="Automática: a lista com o nome do cliente (pastas de clientes antigos ficam por último).">
            <Select id="content-list" value={listChoice} onChange={(e) => setListChoice(e.target.value)}>
              <option value="auto">Automática pelo nome{props.autoName ? ` (${props.autoName})` : " (nenhuma encontrada)"}</option>
              {folders.map((folder) => (
                <optgroup key={folder} label={folder}>
                  {lists
                    .filter((l) => (l.folder ?? "Sem pasta") === folder)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Checkbox
            className="self-center"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            label="Mostrar a área Conteúdo no portal do cliente"
            description={preview ? `O cliente vê ${preview.visible} dos ${preview.total} itens do período.` : "A área aparece quando a lista tiver conteúdos visíveis."}
          />
        </div>
      </section>

      <section className="card space-y-5 p-4 sm:p-5" aria-label="O que o cliente vê">
        <div>
          <h2 className="text-base font-bold text-text">O que o cliente vê</h2>
          <p className="mt-0.5 text-[13px] text-text-3">Regras aplicadas aos itens da lista antes de irem para o portal.</p>
        </div>

        <fieldset className="space-y-2.5">
          <legend className="mb-2.5 text-[13px] font-bold text-text-2">Tipos de item (campo TIPO)</legend>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {typeOptions.map((o) => (
              <Checkbox key={o.value} checked={rules.types.includes(o.value)} onChange={(e) => toggleType(o.value, e.target.checked)} label={o.label} />
            ))}
          </div>
          <p className="text-xs text-text-3">Itens sem tipo aparecem quando têm formato ou legenda.</p>
        </fieldset>

        <div className="border-t border-border pt-4">
          <fieldset className="space-y-1">
            <legend className="mb-2.5 text-[13px] font-bold text-text-2">Esconder do portal</legend>
            <Checkbox checked={rules.hidePlaceholders} onChange={(e) => set("hidePlaceholders", e.target.checked)} label="Itens chamados “TEMA”, ainda sem legenda" />
            <Checkbox checked={rules.hideToConfirm} onChange={(e) => set("hideToConfirm", e.target.checked)} label="Itens com “(confirmar …)” no nome" />
            <Checkbox checked={rules.hideInternalTag} onChange={(e) => set("hideInternalTag", e.target.checked)} label="Itens com a etiqueta “interno”" />
          </fieldset>
        </div>

        <div className="border-t border-border pt-4">
          <fieldset className="space-y-1">
            <legend className="mb-2.5 text-[13px] font-bold text-text-2">Textos</legend>
            <Checkbox checked={rules.showCaption} onChange={(e) => set("showCaption", e.target.checked)} label="Mostrar a legenda (campo Legenda)" />
            <Checkbox
              checked={rules.showDescription}
              onChange={(e) => set("showDescription", e.target.checked)}
              label="Mostrar a descrição da tarefa"
              description="A descrição costuma misturar o texto do card com notas internas da equipe. Deixe desligado, a menos que a lista deste cliente não use notas na descrição."
            />
          </fieldset>
        </div>

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <Field label="Mostrar para trás" htmlFor="content-back">
            <Select id="content-back" value={rules.daysBack} onChange={(e) => set("daysBack", Number(e.target.value))}>
              {BACK_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? "Só a partir de hoje" : `${d} dias`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mostrar à frente" htmlFor="content-ahead">
            <Select id="content-ahead" value={rules.daysAhead} onChange={(e) => set("daysAhead", Number(e.target.value))}>
              {AHEAD_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="primary" onClick={save} disabled={pending} aria-busy={pending}>
            {pending ? "Salvando…" : "Salvar regras"}
          </Button>
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-5" aria-label="Status no portal">
        <div>
          <h2 className="text-base font-bold text-text">Status no portal</h2>
          <p className="mt-0.5 text-[13px] text-text-3">Os status da lista viram cinco situações na linguagem do cliente.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr>
                <th scope="col">No ClickUp</th>
                <th scope="col">O cliente vê</th>
              </tr>
            </thead>
            <tbody>
              {statusMap.map((row) => (
                <tr key={row.status}>
                  <td className="whitespace-normal leading-7 text-text-2">
                    {row.sources.length ? (
                      row.sources.map((s) => (
                        <span key={s.name} className="mr-3 inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="size-2 rounded-[2px]" style={{ background: s.color ?? "var(--text-3)" }} aria-hidden />
                          {s.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-text-3">—</span>
                    )}
                  </td>
                  <td className="align-top">
                    <Badge tone={CONTENT_STATUS_TONE[row.status]}>{CONTENT_STATUS_LABEL[row.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {preview ? (
        <section className="card space-y-4 p-4 sm:p-5 xl:col-span-2" aria-label="Prévia da sincronização">
          <h2 className="text-base font-bold text-text">Prévia da sincronização</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Na lista" value={preview.total} />
            <Stat label="No portal" value={preview.visible} tone="text-primary" />
            <Stat label="Ocultos" value={preview.hidden} />
            <Stat label="Aguardam o cliente" value={preview.awaiting} tone={preview.awaiting ? "text-attention" : undefined} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[13px] font-bold text-text-2">Ficam fora do portal ({hidden.length})</h3>
              {hidden.length ? (
                <ul className="divide-y divide-border rounded-[12px] border border-border">
                  {hidden.map((h) => (
                    <li key={h.id} className="flex gap-3 px-3 py-2.5 text-[13px]">
                      <span className="tabular w-11 shrink-0 text-text-3">{formatDate(h.date).slice(0, 5)}</span>
                      {h.url ? (
                        <a href={h.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-text hover:text-primary">
                          {h.name}
                        </a>
                      ) : (
                        <span className="min-w-0 flex-1 text-text">{h.name}</span>
                      )}
                      <span className="shrink-0 text-text-3">{h.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-text-3">Todos os itens do período aparecem no portal.</p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-[13px] font-bold text-text-2">Vale revisar no ClickUp</h3>
              <ul className="space-y-2">
                {warnings.pastNotPublished.length ? (
                  <Warning tone="attention" title={`${warnings.pastNotPublished.length} ${warnings.pastNotPublished.length === 1 ? "conteúdo com data passada ainda não publicado" : "conteúdos com data passada ainda não publicados"}`} items={warnings.pastNotPublished} hint="O cliente vê o status que está no ClickUp." />
                ) : null}
                {preview.awaiting ? <Warning tone="attention" title={`${preview.awaiting} ${preview.awaiting === 1 ? "conteúdo aguarda" : "conteúdos aguardam"} o cliente`} hint="O cliente vê o destaque “Aguardam sua aprovação” no topo do calendário." /> : null}
                {warnings.noFormat.length ? <Warning title={`${warnings.noFormat.length} ${warnings.noFormat.length === 1 ? "conteúdo sem formato" : "conteúdos sem formato"}`} items={warnings.noFormat} hint="Aparecem como “Formato a definir”." /> : null}
                {!warnings.pastNotPublished.length && !preview.awaiting && !warnings.noFormat.length ? <li className="text-[13px] text-text-3">Nada para revisar.</li> : null}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-[14px] bg-surface-2 px-4 py-3">
      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-3">{label}</p>
      <p className={cn("tabular mt-1 text-2xl font-bold text-text", tone)}>{value}</p>
    </div>
  );
}

function Warning({ title, hint, items, tone }: { title: string; hint: string; items?: Array<{ id: string; date: string; name: string }>; tone?: "attention" }) {
  return (
    <li className={cn("rounded-[12px] px-3.5 py-3 text-[13px] leading-relaxed", tone === "attention" ? "bg-attention-soft" : "bg-surface-2")}>
      <strong className={tone === "attention" ? "text-attention" : "text-text"}>{title}</strong>
      {items?.length ? <span className="block text-text-2">{items.slice(0, 6).map((i) => `${formatDate(i.date).slice(0, 5)} ${i.name}`).join(" · ")}{items.length > 6 ? " · …" : ""}</span> : null}
      <span className="block text-text-3">{hint}</span>
    </li>
  );
}
