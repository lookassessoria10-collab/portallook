import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/ids";

const moduleInput = z
  .object({
    enabled: z.boolean(),
    cadence: z.enum(["monthly", "weekly"]),
    dueDay: z.coerce.number().int().min(1).max(28),
    allowOriginalDownload: z.boolean(),
  })
  .refine((m) => m.cadence !== "weekly" || m.dueDay <= 7, { message: "Escolha um dia da semana.", path: ["dueDay"] });

/** Dados editáveis pelo ADM (formulário de cadastro/edição). */
export const ClientInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  shortName: z.string().trim().min(1, "Informe um nome curto.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "O endereço precisa de pelo menos 2 caracteres.")
    .max(48)
    .regex(SLUG_PATTERN, "Use apenas letras minúsculas, números e hífens."),
  greetingName: z.string().trim().max(60).default(""),
  segment: z.string().trim().max(80).default(""),
  currency: z.string().trim().toUpperCase().length(3).default("BRL"),
  notes: z.string().max(4000).default(""),
  roiMetric: z.enum(["roas", "roiPercent"]).default("roas"),
  commercial: moduleInput,
  traffic: moduleInput,
});
export type ClientInput = z.infer<typeof ClientInputSchema>;

export function clientInputFromForm(form: FormData): unknown {
  const bool = (k: string) => form.get(k) === "on" || form.get(k) === "true";
  const str = (k: string) => (form.get(k) ?? "").toString();
  return {
    name: str("name"),
    shortName: str("shortName") || str("name"),
    slug: str("slug"),
    greetingName: str("greetingName"),
    segment: str("segment"),
    currency: str("currency") || "BRL",
    notes: str("notes"),
    roiMetric: str("roiMetric") || "roas",
    commercial: {
      enabled: bool("commercial.enabled"),
      cadence: str("commercial.cadence") || "monthly",
      dueDay: str("commercial.dueDay") || "5",
      allowOriginalDownload: bool("commercial.allowOriginalDownload"),
    },
    traffic: {
      enabled: bool("traffic.enabled"),
      cadence: str("traffic.cadence") || "weekly",
      dueDay: str("traffic.dueDay") || "1",
      allowOriginalDownload: bool("traffic.allowOriginalDownload"),
    },
  };
}

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
