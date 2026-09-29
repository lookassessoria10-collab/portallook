import { CircleAlert, CircleCheck, CircleDashed, Clock, FilePen, Minus, Archive, EyeOff, Layers } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { DELIVERY_LABEL, type DeliveryState } from "@/features/reports/delivery";
import type { ReportStatus } from "@/features/reports/schema";
import { IMPORT_STATUS_LABEL, type ImportStatus } from "@/features/uploads/schema";

const DELIVERY: Record<DeliveryState, { tone: Tone; icon: typeof Clock }> = {
  updated: { tone: "positive", icon: CircleCheck },
  pending: { tone: "attention", icon: Clock },
  draft: { tone: "info", icon: FilePen },
  error: { tone: "negative", icon: CircleAlert },
  upcoming: { tone: "neutral", icon: CircleDashed },
  not_applicable: { tone: "muted", icon: Minus },
};

/** Estado sempre com ícone + texto (nunca só cor). */
export function DeliveryBadge({ state, label }: { state: DeliveryState; label?: string }) {
  const d = DELIVERY[state];
  const Icon = d.icon;
  return (
    <Badge tone={d.tone} icon={<Icon />}>
      {label ?? DELIVERY_LABEL[state]}
    </Badge>
  );
}

const REPORT: Record<ReportStatus, { tone: Tone; label: string; icon: typeof Clock }> = {
  draft: { tone: "info", label: "Rascunho", icon: FilePen },
  published: { tone: "positive", label: "Publicado", icon: CircleCheck },
  unpublished: { tone: "neutral", label: "Retirado", icon: EyeOff },
  superseded: { tone: "muted", label: "Substituído", icon: Layers },
  archived: { tone: "muted", label: "Arquivado", icon: Archive },
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const r = REPORT[status];
  const Icon = r.icon;
  return (
    <Badge tone={r.tone} icon={<Icon />}>
      {r.label}
    </Badge>
  );
}

const IMPORT_TONE: Record<ImportStatus, Tone> = {
  awaiting_file: "neutral",
  uploaded: "neutral",
  validated: "info",
  invalid: "negative",
  imported: "positive",
  discarded: "muted",
  failed: "negative",
};

export function ImportStatusBadge({ status }: { status: string }) {
  const s = (status in IMPORT_TONE ? status : "uploaded") as ImportStatus;
  return <Badge tone={IMPORT_TONE[s]}>{IMPORT_STATUS_LABEL[s]}</Badge>;
}
