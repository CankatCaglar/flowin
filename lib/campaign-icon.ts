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
  { icon: Users, className: "bg-violet-100 text-barney" },
  { icon: ShoppingCart, className: "bg-sky-100 text-sky-600" },
  { icon: LineChart, className: "bg-orange-100 text-orange-600" },
  { icon: Briefcase, className: "bg-emerald-100 text-emerald-700" },
  { icon: Building2, className: "bg-indigo-100 text-indigo-600" },
  { icon: Target, className: "bg-rose-100 text-rose-600" },
];

export function campaignIconStyle(id: string) {
  const index = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return STYLES[index % STYLES.length];
}
