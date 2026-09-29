import { Globe, HeartHandshake, Handshake, Megaphone, MessageCircle, Newspaper, Repeat, Search, Sprout, Stethoscope, Store, Circle } from "lucide-react";
import { normalizeText } from "@/lib/ids";
import type { ChannelKind } from "@/features/commercial/schema";

/** Ícones genéricos e consistentes (sem logos de marcas de terceiros). */
export function ChannelIcon({ kind, name }: { kind: ChannelKind; name: string }) {
  const n = normalizeText(name);
  if (n.includes("google")) return <Search aria-hidden />;
  if (n.includes("whatsapp")) return <MessageCircle aria-hidden />;
  if (n.includes("doctoralia") || n.includes("medic")) return <Stethoscope aria-hidden />;
  if (n.includes("site")) return <Globe aria-hidden />;
  if (n.includes("panflet") || n.includes("jornal") || n.includes("radio")) return <Newspaper aria-hidden />;
  switch (kind) {
    case "paid":
      return <Megaphone aria-hidden />;
    case "organic":
      return <Sprout aria-hidden />;
    case "referral":
      return <HeartHandshake aria-hidden />;
    case "recurring":
      return <Repeat aria-hidden />;
    case "marketplace":
      return <Store aria-hidden />;
    case "partner":
      return <Handshake aria-hidden />;
    case "offline":
      return <Newspaper aria-hidden />;
    default:
      return <Circle aria-hidden />;
  }
}
