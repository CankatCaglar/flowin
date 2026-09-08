import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  LineChart,
  ShoppingCart,
  Target,
  Users,
} from "lucide-react";

const STYLES: { icon: LucideIcon; className: string }[] = [
  { icon: Users, className: "text-barney" },
  { icon: ShoppingCart, className: "text-sky-600" },
  { icon: LineChart, className: "text-orange-600" },
  { icon: Briefcase, className: "text-emerald-700" },
  { icon: Building2, className: "text-indigo-600" },
  { icon: Target, className: "text-rose-600" },
];

export function campaignIconStyle(id: string) {
  const index = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return STYLES[index % STYLES.length];
}
