import { BadgeDollarSign, CircleUserRound, Eye, Heart, Megaphone, MessageCircleHeart, MousePointerClick, Percent, Play, Receipt, ShoppingCart, TrendingUp, UserCheck, UserPlus, Users, Wallet } from "lucide-react";
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
  followers: Users,
  newFollowers: UserPlus,
  reach: Eye,
  views: Play,
  engagement: Heart,
  interactions: MessageCircleHeart,
  visits: CircleUserRound,
  clicks: MousePointerClick,
};

export function KpiIcon({ name }: { name: KpiIconName }) {
  const Icon = ICONS[name] ?? Eye;
  return <Icon aria-hidden />;
}
