import { BadgeDollarSign, Eye, Megaphone, Percent, Receipt, ShoppingCart, TrendingUp, UserCheck, Users, Wallet } from "lucide-react";
import type { KpiIcon as KpiIconName } from "@/features/commercial/view-model";

const ICONS: Record<KpiIconName, typeof Users> = {
  leads: Users,
  conversions: UserCheck,
  revenue: Wallet,
  investment: Megaphone,
  roas: TrendingUp,
  rate: Percent,
  ticket: Receipt,
  cost: BadgeDollarSign,
  sales: ShoppingCart,
};

export function KpiIcon({ name }: { name: KpiIconName }) {
  const Icon = ICONS[name] ?? Eye;
  return <Icon aria-hidden />;
}
