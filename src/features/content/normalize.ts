import { z } from "zod";
import { todayISO } from "@/lib/dates/period";
import { normalizeText } from "@/lib/ids";
import type { ContentItem } from "./schema";

/**
 * Formato das tarefas na API v2 do ClickUp (`GET /list/{id}/task`). Só os campos usados
 * são validados; o resto passa sem ser lido.
 */
const RawOptionSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  label: z.string().optional(),
  orderindex: z.union([z.number(), z.string()]).optional(),
});

const RawCustomFieldSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  type_config: z.looseObject({ options: z.array(RawOptionSchema).optional() }).optional(),
  value: z.unknown().optional(),
});

export const RawTaskSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  text_content: z.string().nullable().optional(),
  status: z.looseObject({ status: z.string(), color: z.string().nullable().optional(), type: z.string().nullable().optional() }),
  due_date: z.union([z.string(), z.number()]).nullable().optional(),
  due_date_time: z.boolean().nullable().optional(),
  tags: z.array(z.looseObject({ name: z.string() })).optional(),
  custom_fields: z.array(RawCustomFieldSchema).optional(),
});
export type RawTask = z.infer<typeof RawTaskSchema>;
type RawField = z.infer<typeof RawCustomFieldSchema>;

/** Campos da lista, reconhecidos pelo nome (sem acento e caixa) — os ids mudam de lista para lista. */
const FIELD_NAMES = {
  format: ["formato"],
  channel: ["canal", "canais"],
  type: ["tipo"],
  caption: ["legenda"],
  progress: ["andamento"],
} as const;

function findField(fields: RawField[], names: readonly string[]): RawField | undefined {
  return fields.find((f) => names.includes(normalizeText(f.name)));
}

/** Lista suspensa: o valor é o id da opção ou, nas listas antigas, a posição (orderindex). */
export function dropdownValue(field: RawField | undefined): string | null {
  if (!field || field.value === undefined || field.value === null || field.value === "") return null;
  const options = field.type_config?.options ?? [];
  const raw = field.value;
  const byId = options.find((o) => o.id !== undefined && String(o.id) === String(raw));
  const option = byId ?? (typeof raw === "number" || /^\d+$/.test(String(raw)) ? options.find((o) => o.orderindex !== undefined && Number(o.orderindex) === Number(raw)) : undefined);
  const name = option?.name ?? option?.label;
  return name ? name.trim() : null;
}

function labelsValue(field: RawField | undefined): string[] {
  if (!field || !Array.isArray(field.value)) return [];
  const options = field.type_config?.options ?? [];
  return field.value
    .map((v) => options.find((o) => o.id !== undefined && String(o.id) === String(v)))
    .map((o) => (o?.label ?? o?.name ?? "").trim())
    .filter(Boolean);
}

function textValue(field: RawField | undefined): string | null {
  if (!field || typeof field.value !== "string") return null;
  const text = field.value.trim();
  return text || null;
}

function fieldValue(field: RawField | undefined): string | null {
  if (!field) return null;
  return field.type === "drop_down" ? dropdownValue(field) : textValue(field);
}

function timeIn(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

/** Tarefa do ClickUp → item do portal. Tarefas sem data ficam de fora (não cabem no calendário). */
export function normalizeTask(input: unknown, timeZone: string): ContentItem | null {
  const parsed = RawTaskSchema.safeParse(input);
  if (!parsed.success) return null;
  const t = parsed.data;
  const ms = t.due_date === null || t.due_date === undefined || t.due_date === "" ? NaN : Number(t.due_date);
  if (!Number.isFinite(ms)) return null;
  const due = new Date(ms);
  const fields = t.custom_fields ?? [];
  const description = (t.text_content ?? "").trim();
  return {
    id: t.id,
    name: t.name.trim(),
    url: t.url ?? `https://app.clickup.com/t/${t.id}`,
    date: todayISO(timeZone, due),
    time: t.due_date_time ? timeIn(timeZone, due) : null,
    statusName: t.status.status,
    statusColor: t.status.color ?? null,
    statusType: t.status.type ?? null,
    format: fieldValue(findField(fields, FIELD_NAMES.format)),
    channel: fieldValue(findField(fields, FIELD_NAMES.channel)),
    type: fieldValue(findField(fields, FIELD_NAMES.type)),
    caption: textValue(findField(fields, FIELD_NAMES.caption)),
    description: description || null,
    progress: labelsValue(findField(fields, FIELD_NAMES.progress)),
    tags: (t.tags ?? []).map((tag) => tag.name),
  };
}

/** Opções do campo TIPO que aparecem nas tarefas (para o painel montar as caixas de seleção). */
export function typeOptionsFrom(tasks: unknown[]): string[] {
  const names = new Set<string>();
  for (const input of tasks) {
    const parsed = RawTaskSchema.safeParse(input);
    if (!parsed.success) continue;
    const field = findField(parsed.data.custom_fields ?? [], FIELD_NAMES.type);
    for (const o of field?.type_config?.options ?? []) if (o.name) names.add(o.name.trim());
  }
  return [...names];
}
