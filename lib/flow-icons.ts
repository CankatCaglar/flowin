import type { LucideIcon } from "lucide-react";
import { Clock3, Eye, Mail, MessageSquare, UserPlus } from "lucide-react";
import type { FlowStepKind } from "@/types";

export const flowStepIcons: Record<FlowStepKind, LucideIcon> = {
  connection: UserPlus,
  message: MessageSquare,
  connection_check: Clock3,
  profile_view: Eye,
  inmail: Mail,
};
