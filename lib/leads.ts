import type { Lead, LeadEvent, LeadEventKind, LeadStage, LeadStatus } from "@/types";

export const LEAD_STAGES: LeadStage[] = [
  "connection_request",
  "profile_viewed",
  "message_1",
  "message_2",
  "message_3",
  "flow_completed",
];

export type LeadStatusLabelKey =
  | LeadStatus
  | "queued_view"
  | "waiting_connection"
  | "waiting_accept"
  | "queued_message";

export const LEAD_EVENT_KINDS: LeadEventKind[] = [
  "added",
  "profile_viewed",
  "connection_sent",
  "accepted",
  "message_1_sent",
  "message_2_sent",
  "message_3_sent",
  "inmail_sent",
  "replied",
  "failed",
];

export function isLeadEventKind(value: unknown): value is LeadEventKind {
  return LEAD_EVENT_KINDS.includes(value as LeadEventKind);
}

export const LEAD_STATUSES: LeadStatus[] = [
  "queued",
  "waiting_reply",
  "replied",
  "failed",
  "flow_completed",
];

const LEGACY_STATUS: Record<string, LeadStatus> = {
  unresponsive: "waiting_reply",
  in_progress: "queued",
  queued: "queued",
  waiting_reply: "waiting_reply",
  replied: "replied",
  failed: "failed",
  flow_completed: "flow_completed",
};

const LEGACY_STAGE: Record<string, LeadStage> = {
  first_contact: "connection_request",
  interested: "message_1",
  proposal: "message_2",
  awaiting_reply: "message_1",
  replied: "message_1",
  failed: "connection_request",
  connection_request: "connection_request",
  profile_viewed: "profile_viewed",
  message_1: "message_1",
  message_2: "message_2",
  message_3: "message_3",
  flow_completed: "flow_completed",
};

const STAGE_RANK: Record<LeadStage, number> = {
  connection_request: 0,
  profile_viewed: 1,
  message_1: 2,
  message_2: 3,
  message_3: 4,
  flow_completed: 5,
};

export function historyHas(lead: Pick<Lead, "history">, kind: LeadEventKind) {
  return lead.history.some((event) => event.kind === kind);
}

export function deriveLeadStage(lead: Pick<Lead, "status" | "stage" | "history">): LeadStage {
  if (lead.status === "flow_completed") return "flow_completed";
  const viewed = historyHas(lead, "profile_viewed");
  const invited = historyHas(lead, "connection_sent");
  const accepted = historyHas(lead, "accepted");
  if (historyHas(lead, "message_3_sent")) return "message_3";
  if (historyHas(lead, "message_2_sent")) return "message_2";
  if (historyHas(lead, "message_1_sent") || accepted) return "message_1";
  if (invited) return "connection_request";
  if (viewed) return "profile_viewed";
  return lead.stage === "profile_viewed" ? "profile_viewed" : "connection_request";
}

export function leadStatusLabelKey(lead: Lead): LeadStatusLabelKey {
  if (lead.status === "failed") return "failed";
  if (lead.status === "replied") return "replied";
  if (lead.status === "flow_completed") return "flow_completed";
  if (lead.status === "waiting_reply") {
    if (lead.awaiting === "connection") return "waiting_accept";
    return "waiting_reply";
  }
  if (!historyHas(lead, "profile_viewed")) return "queued_view";
  if (!historyHas(lead, "connection_sent")) return "waiting_connection";
  if (lead.currentBranch === "accepted" || historyHas(lead, "accepted")) return "queued_message";
  return "queued";
}

export function asLeadStatus(value: unknown): LeadStatus {
  return LEGACY_STATUS[String(value ?? "")] ?? "queued";
}

export function asLeadStage(value: unknown, status: LeadStatus): LeadStage {
  if (status === "flow_completed") return "flow_completed";
  const raw = String(value ?? "");
  if (raw === "failed") return "connection_request";
  return LEGACY_STAGE[raw] ?? "connection_request";
}

export function historyKinds(stage: LeadStage, status: LeadStatus): LeadEventKind[] {
  if (status === "queued" && stage === "connection_request") {
    return ["added"];
  }

  const events: LeadEventKind[] = ["added", "connection_sent"];

  if (stage === "connection_request") {
    if (status === "failed") return [...events, "failed"];
    if (status === "replied") return [...events, "replied"];
    return events;
  }

  events.push("accepted");

  const messages: { stage: LeadStage; kind: LeadEventKind }[] = [
    { stage: "message_1", kind: "message_1_sent" },
    { stage: "message_2", kind: "message_2_sent" },
    { stage: "message_3", kind: "message_3_sent" },
  ];

  for (const message of messages) {
    const reached = STAGE_RANK[stage] >= STAGE_RANK[message.stage];
    const current = stage === message.stage;

    if (current && status === "queued") {
      return events;
    }
    if (current && status === "failed") {
      return [...events, "failed"];
    }
    if (!reached) break;

    events.push(message.kind);

    if (current && status === "waiting_reply") return events;
    if (current && status === "replied") return [...events, "replied"];
  }

  if (stage === "flow_completed") {
    return events;
  }

  if (status === "replied") return [...events, "replied"];
  if (status === "failed") return [...events, "failed"];
  return events;
}

function gapBefore(kind: LeadEventKind): number {
  if (kind === "replied") return 45;
  if (kind === "failed") return 20;
  if (kind === "accepted") return 12;
  if (kind === "message_1_sent") return 17;
  if (kind === "message_2_sent" || kind === "message_3_sent") return 24 * 60 + 18;
  if (kind === "connection_sent") return 8;
  return 10;
}

export function synthesizeHistory(
  stage: LeadStage,
  status: LeadStatus,
  lastActionAt: Date,
  firstReplyReceivedAt?: Date,
): LeadEvent[] {
  const kinds = historyKinds(stage, status);
  if (kinds.length === 0) return [];

  const times: Date[] = new Array(kinds.length);
  const lastKind = kinds[kinds.length - 1];
  times[kinds.length - 1] =
    lastKind === "replied" && firstReplyReceivedAt ? firstReplyReceivedAt : lastActionAt;

  for (let index = kinds.length - 2; index >= 0; index -= 1) {
    const nextKind = kinds[index + 1];
    const gap = gapBefore(nextKind ?? "added");
    times[index] = new Date(times[index + 1].getTime() - gap * 60 * 1000);
  }

  return kinds.map((kind, index) => ({ kind, at: times[index] }));
}

export function lastOutboundAt(history: LeadEvent[], fallback: Date): Date {
  const outbound = [...history]
    .reverse()
    .find((event) => event.kind !== "replied" && event.kind !== "added");
  return outbound?.at ?? history[history.length - 1]?.at ?? fallback;
}

export function leadLastActionAt(lead: Lead): Date {
  const last = lead.history[lead.history.length - 1];
  return last?.at ?? lead.lastMessageSentAt;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function exportLeadsCsv(
  leads: Lead[],
  {
    campaignNames,
    stageLabel,
    statusLabel,
    lastAction,
    filename = "leads.csv",
  }: {
    campaignNames: Map<string, string>;
    stageLabel: (stage: LeadStage) => string;
    statusLabel: (status: LeadStatus, lead: Lead) => string;
    lastAction: (lead: Lead) => string;
    filename?: string;
  },
) {
  const header = [
    "name",
    "company",
    "position",
    "campaign",
    "stage",
    "status",
    "lastAction",
    "email",
    "phone",
    "linkedin",
  ];
  const lines = [
    header.join(","),
    ...leads.map((lead) =>
      [
        lead.fullName,
        lead.company,
        lead.position,
        campaignNames.get(lead.campaignId) ?? lead.campaignId,
        stageLabel(lead.stage),
        statusLabel(lead.status, lead),
        lastAction(lead),
        lead.email,
        lead.phone,
        lead.linkedinUrl,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
