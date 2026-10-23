"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FileSpreadsheet, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/dates/period";
import { normalizeText } from "@/lib/ids";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/confirm-action";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { deleteActionAction, importActionsSheetAction, saveActionAction, setActionsEnabledAction, setActionVisibleAction } from "@/features/actions/actions";
import { ACTION_KIND_LABEL, ACTION_STATUS_LABEL, ACTION_STATUS_TONE, ACTION_STATUSES, type ActionKind, type ActionStatus, type ClientAction } from "@/features/actions/schema";
import { sortActions, summarizeActions } from "@/features/actions/view-model";

export interface ClientActionsManagerProps {
  clientId: string;
  items: ClientAction[];
  enabled: boolean;
  origin: "stored" | "sheet" | "none";
  sheet: string | null;
  extractedAt: string | null;
  /** Data e hora da última alteração no painel, já no fuso do portal. */
  updatedLabel: string | null;
  sheetNames: string[];
  previewHref: string;
}

/** Aba "Ações" do cliente no painel: indicadores da planilha, lista com filtros e edição. */
export function ClientActionsManager(props: ClientActionsManagerProps) {
  const { clientId, items, enabled, origin, sheet, sheetNames, previewHref } = props;
  const [filter, setFilter] = useState<ActionStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ClientAction | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const summary = useMemo(() => summarizeActions(items), [items]);
  const categories = useMemo(() => summary.categories.map((c) => c.label), [summary]);
  const hidden = items.filter((a) => !a.visible).length;

  const q = normalizeText(query);
  const list = sortActions(items).filter((a) => (filter === "all" || a.status === filter) && (!q || normalizeText(`${a.title} ${a.category} ${a.notes} ${a.progress}`).includes(q)));

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5" aria-label="Origem das ações">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-text">Ações do cliente</h2>
              {origin === "sheet" ? (
                <Badge tone="info" icon={<FileSpreadsheet />}>
                  Planilha · aba {sheet}
                </Badge>
              ) : origin === "stored" ? (
                <Badge tone="positive">Mantidas pelo painel</Badge>
              ) : (
                <Badge tone="muted">Fora da planilha</Badge>
              )}
              {!enabled ? <Badge tone="attention">Escondidas do portal</Badge> : null}
            </div>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-text-3">
              {origin === "sheet" ? (
                <>
                  Ações da aba <strong className="text-text-2">{sheet}</strong> da planilha de ações da Look
                  {props.extractedAt ? <> (extraída em {formatDate(props.extractedAt)})</> : null}. A primeira alteração feita aqui grava a lista no painel, que passa a valer no lugar da planilha.
                </>
              ) : origin === "stored" ? (
                <>
                  Lista mantida pelo painel{sheet ? <> (importada da aba <strong className="text-text-2">{sheet}</strong> da planilha)</> : null}
                  {props.updatedLabel ? <>, alterada pela última vez em {props.updatedLabel}</> : null}.
                </>
              ) : (
                <>Nenhuma aba da planilha de ações corresponde a este cliente. Cadastre ações aqui ou importe uma aba da planilha.</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden /> Nova ação
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
              <FileSpreadsheet className="size-4" aria-hidden /> Importar da planilha
            </Button>
            {summary.total ? (
              <Link href={previewHref} className={buttonClass("ghost", "sm")}>
                <Eye className="size-4" aria-hidden /> Prévia no portal
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <ActionButton
            action={() => setActionsEnabledAction(clientId, !enabled)}
            variant={enabled ? "ghost" : "subtle"}
            size="sm"
            icon={enabled ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            confirm={
              enabled
                ? { title: "Esconder a área Ações do portal?", description: "O cliente deixa de ver a área Ações. Nada é apagado e você pode mostrar de novo quando quiser.", confirmLabel: "Esconder", tone: "danger" }
                : undefined
            }
          >
            {enabled ? "Esconder a área Ações do portal" : "Mostrar a área Ações no portal"}
          </ActionButton>
          <span className="ml-2 text-[13px] text-text-3">
            {enabled ? (summary.total - hidden > 0 ? `O cliente vê ${summary.total - hidden} de ${summary.total} ações.` : "Sem ações visíveis: a área não aparece para o cliente.") : "O cliente não vê a área Ações."}
          </span>
        </div>
      </section>

      <section aria-label="Indicadores das ações" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total de ações" value={summary.total} />
        <Stat label="Em andamento" value={summary.byStatus.in_progress} tone="text-primary" />
        <Stat label="Executadas" value={summary.executed} hint="com data de execução" />
        <Stat label="Concluídas" value={summary.byStatus.done} tone="text-positive" />
        <Stat label="Sem status" value={summary.byStatus.suggested} tone="text-text-2" />
      </section>

      <section className="card" aria-label="Lista de ações">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Filtrar por status" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip active={filter === "all"} onClick={() => setFilter("all")} label="Todas" count={summary.total} />
            {ACTION_STATUSES.filter((s) => summary.byStatus[s] > 0).map((s) => (
              <Chip key={s} active={filter === s} onClick={() => setFilter(s)} label={FILTER_LABEL[s]} count={summary.byStatus[s]} />
            ))}
          </div>
          <label className="relative block lg:w-72">
            <span className="sr-only">Buscar ação</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ação, frente ou observação" className="h-9 pl-9 text-sm" />
          </label>
        </div>
        {list.length ? (
          <ul className="divide-y divide-border">
            {list.map((a) => (
              <ActionRow key={a.id} clientId={clientId} action={a} onEdit={() => setEditing(a)} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-text-3">{summary.total ? "Nenhuma ação com esse filtro." : "Nenhuma ação cadastrada para este cliente."}</p>
        )}
      </section>

      {editing ? <ActionDialog clientId={clientId} action={editing === "new" ? null : editing} categories={categories} onClose={() => setEditing(null)} /> : null}
      {importing ? <ImportDialog clientId={clientId} sheetNames={sheetNames} current={sheet} hasItems={summary.total > 0} onClose={() => setImporting(false)} /> : null}
    </div>
  );
}

const FILTER_LABEL: Record<ActionStatus, string> = {
  in_progress: "Em andamento",
  pending: "Pendências",
  approved: "Aprovadas",
  done: "Concluídas",
  suggested: "Sem status",
  rejected: "Não aprovadas",
};

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-3">{label}</p>
      <p className={cn("tabular mt-1 text-2xl font-bold text-text", tone)}>{value}</p>
      {hint ? <p className="text-[11px] text-text-3">{hint}</p> : null}
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold", active ? "border-transparent bg-primary text-on-primary" : "border-border-strong text-text-2 hover:bg-surface-2")}
    >
      {label}
      <span className="tabular text-[11px] font-bold opacity-75">{count}</span>
    </button>
  );
}

function ActionRow({ clientId, action: a, onEdit }: { clientId: string; action: ClientAction; onEdit: () => void }) {
  return (
    <li className={cn("flex flex-col gap-3 p-4 sm:px-5 lg:flex-row lg:items-start lg:gap-6", !a.visible && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={ACTION_STATUS_TONE[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Badge>
          {a.category ? <Badge tone="muted">{a.category}</Badge> : null}
          {a.kind ? <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-3">{ACTION_KIND_LABEL[a.kind]}</span> : null}
          {!a.visible ? (
            <Badge tone="attention" icon={<EyeOff />}>
              Só no painel
            </Badge>
          ) : null}
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-snug text-text">{a.title}</p>
        {a.notes ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-3">
            <span className="font-semibold text-text-2">Observações (interno):</span> {a.notes}
          </p>
        ) : null}
        {a.progress ? (
          <p className="mt-1 text-[13px] leading-relaxed text-text-3">
            <span className="font-semibold text-text-2">Andamento (interno):</span> {a.progress}
          </p>
        ) : null}
        {a.clientNote ? (
          <p className="mt-1 text-[13px] leading-relaxed text-text-3">
            <span className="font-semibold text-text-2">Para o cliente:</span> {a.clientNote}
          </p>
        ) : null}
      </div>
      <dl className="grid shrink-0 grid-cols-3 gap-3 text-[13px] lg:w-[300px]">
        <div>
          <dt className="text-[11px] text-text-3">Sugerida</dt>
          <dd className="tabular font-semibold text-text-2">{formatDate(a.suggestedAt)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-text-3">Executada</dt>
          <dd className="tabular font-semibold text-text-2">{formatDate(a.executedAt)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-text-3">Atualizada</dt>
          <dd className="tabular font-semibold text-text-2">{formatDate(a.lastUpdateAt)}</dd>
        </div>
      </dl>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Editar: ${a.title}`}>
          <Pencil className="size-4" aria-hidden /> Editar
        </Button>
        <ActionButton
          action={() => setActionVisibleAction(clientId, a.id, !a.visible)}
          variant="ghost"
          size="sm"
          ariaLabel={a.visible ? "Esconder do portal" : "Mostrar no portal"}
          icon={a.visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        >
          <span className="sr-only">{a.visible ? "Esconder do portal" : "Mostrar no portal"}</span>
        </ActionButton>
        <ActionButton
          action={() => deleteActionAction(clientId, a.id)}
          variant="ghost"
          size="sm"
          ariaLabel="Excluir ação"
          icon={<Trash2 className="size-4" aria-hidden />}
          confirm={{ title: "Excluir esta ação?", description: <>“{a.title}” sai do painel e do portal. Para só tirar do portal, use o botão de esconder.</>, confirmLabel: "Excluir", tone: "danger" }}
        >
          <span className="sr-only">Excluir ação</span>
        </ActionButton>
      </div>
    </li>
  );
}

const STATUS_OPTIONS: ActionStatus[] = ["suggested", "approved", "in_progress", "pending", "done", "rejected"];

function ActionDialog({ clientId, action, categories, onClose }: { clientId: string; action: ClientAction | null; categories: string[]; onClose: () => void }) {
  const [draft, setDraft] = useState({
    title: action?.title ?? "",
    category: action?.category ?? "",
    kind: (action?.kind ?? "") as ActionKind | "",
    status: action?.status ?? ("suggested" as ActionStatus),
    suggestedAt: action?.suggestedAt ?? "",
    executedAt: action?.executedAt ?? "",
    lastUpdateAt: action?.lastUpdateAt ?? "",
    progress: action?.progress ?? "",
    notes: action?.notes ?? "",
    clientNote: action?.clientNote ?? "",
    visible: action?.visible ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () =>
    start(async () => {
      const res = await saveActionAction(clientId, { ...draft, id: action?.id, kind: draft.kind || null });
      if (res.ok) {
        toast.success(res.message ?? "Salvo.");
        onClose();
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={action ? "Editar ação" : "Nova ação"}
      description="Observações e andamento são internos. O cliente vê a ação, a frente, o tipo, o status, as datas e o comentário para o cliente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={pending} aria-busy={pending}>
            {pending ? "Salvando…" : action ? "Salvar alterações" : "Adicionar ação"}
          </Button>
        </>
      }
    >
      <div className="grid max-h-[60dvh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
        <Field label="Ação" htmlFor="action-title" error={errors.title} className="sm:col-span-2">
          <Textarea id="action-title" value={draft.title} maxLength={300} rows={2} className="min-h-0" onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Programa de indicação para aquisição por recomendação" />
        </Field>
        <Field label="Frente" htmlFor="action-category" optional hint="Ex.: Institucional, Captação, Relacionamento.">
          <Input id="action-category" value={draft.category} maxLength={60} list="action-categories" onChange={(e) => set("category", e.target.value)} />
          <datalist id="action-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Tipo de ação" htmlFor="action-kind">
          <Select id="action-kind" value={draft.kind} onChange={(e) => set("kind", e.target.value as ActionKind | "")}>
            <option value="">—</option>
            <option value="one_off">Pontual</option>
            <option value="continuous">Contínua</option>
          </Select>
        </Field>
        <Field label="Status" htmlFor="action-status">
          <Select id="action-status" value={draft.status} onChange={(e) => set("status", e.target.value as ActionStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ACTION_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quando foi sugerida" htmlFor="action-suggested" optional error={errors.suggestedAt}>
          <Input id="action-suggested" type="date" value={draft.suggestedAt} onChange={(e) => set("suggestedAt", e.target.value)} />
        </Field>
        <Field label="Quando foi executada" htmlFor="action-executed" optional error={errors.executedAt}>
          <Input id="action-executed" type="date" value={draft.executedAt} onChange={(e) => set("executedAt", e.target.value)} />
        </Field>
        <Field label="Última atualização" htmlFor="action-updated" optional error={errors.lastUpdateAt}>
          <Input id="action-updated" type="date" value={draft.lastUpdateAt} onChange={(e) => set("lastUpdateAt", e.target.value)} />
        </Field>
        <Field label="Andamento / pendências (interno)" htmlFor="action-progress" optional className="sm:col-span-2">
          <Textarea id="action-progress" value={draft.progress} maxLength={2000} rows={2} onChange={(e) => set("progress", e.target.value)} placeholder="O que já foi feito, o que está pendente e o próximo passo." />
        </Field>
        <Field label="Observações (interno)" htmlFor="action-notes" optional className="sm:col-span-2">
          <Textarea id="action-notes" value={draft.notes} maxLength={2000} rows={2} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Field label="Comentário para o cliente" htmlFor="action-client-note" optional hint="Aparece no portal, junto da ação." className="sm:col-span-2">
          <Textarea id="action-client-note" value={draft.clientNote} maxLength={1000} rows={2} onChange={(e) => set("clientNote", e.target.value)} />
        </Field>
        <Checkbox className="sm:col-span-2" checked={draft.visible} onChange={(e) => set("visible", e.target.checked)} label="Mostrar esta ação no portal do cliente" />
      </div>
    </Dialog>
  );
}

function ImportDialog({ clientId, sheetNames, current, hasItems, onClose }: { clientId: string; sheetNames: string[]; current: string | null; hasItems: boolean; onClose: () => void }) {
  const [sheet, setSheet] = useState(current ?? sheetNames[0] ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = () =>
    start(async () => {
      const res = await importActionsSheetAction(clientId, sheet);
      if (res.ok) {
        toast.success(res.message ?? "Importado.");
        onClose();
        router.refresh();
      } else toast.error(res.error);
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Importar da planilha de ações"
      description={hasItems ? "As ações atuais deste cliente serão substituídas pelas da aba escolhida (inclusive as editadas aqui)." : "As ações da aba escolhida passam a ser as deste cliente."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant={hasItems ? "danger" : "primary"} onClick={run} disabled={pending || !sheet} aria-busy={pending}>
            {pending ? "Importando…" : hasItems ? "Substituir ações" : "Importar"}
          </Button>
        </>
      }
    >
      <Field label="Aba da planilha" htmlFor="import-sheet">
        <Select id="import-sheet" value={sheet} onChange={(e) => setSheet(e.target.value)}>
          {sheetNames.map((n) => (
            <option key={n} value={n}>
              {n}
              {n === current ? " (atual)" : ""}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}
