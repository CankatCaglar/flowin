export type CampaignStatus = "active" | "expiring" | "draft" | "completed";
export type LeadStatus =
  | "queued"
  | "waiting_reply"
  | "replied"
  | "failed"
  | "flow_completed";
export type LeadStage =
  | "connection_request"
  | "message_1"
  | "message_2"
  | "message_3"
  | "flow_completed";
export type LeadEventKind =
  | "added"
  | "connection_sent"
  | "accepted"
  | "message_1_sent"
  | "message_2_sent"
  | "message_3_sent"
  | "replied"
  | "failed";
export type DatePreset = "last7" | "thisMonth" | "custom";
export type ChartMetric = "successRate" | "sent" | "replied";
export type FlowDelayUnit = "days" | "hours";
export type FlowStepKind =
  | "connection"
  | "message"
  | "connection_check"
  | "profile_view"
  | "inmail";
/**
 * Steps split by whether the lead reacted — first after the connection
 * request, then again after the InMail on the silent path.
 */
export type FlowBranch =
  | "accepted"
  | "no_response"
  | "inmail_accepted"
  | "inmail_no_response";

export interface Brand {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: Date;
  linkedinSub?: string;
  linkedinEmail?: string;
  avatarUrl?: string;
}

export interface CampaignFlowStep {
  id: string;
  kind: FlowStepKind;
  title: string;
  body: string;
  delayDays: number;
  delayUnit: FlowDelayUnit;
  premium?: boolean;
  branch?: FlowBranch;
  /** Set while the step still uses the built-in template; cleared once edited. */
  templateKey?: string;
}

export interface Campaign {
  id: string;
  brandId: string;
  name: string;
  status: CampaignStatus;
  sentCount: number;
  repliedCount: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  targetAudience: string;
  leadGoal: number;
  flow: CampaignFlowStep[];
}

export interface LeadEvent {
  kind: LeadEventKind;
  at: Date;
}

export interface Lead {
  id: string;
  brandId: string;
  campaignId: string;
  fullName: string;
  linkedinUrl: string;
  status: LeadStatus;
  lastMessageSentAt: Date;
  firstReplyReceivedAt?: Date;
  company: string;
  position: string;
  stage: LeadStage;
  email: string;
  phone: string;
  history: LeadEvent[];
}

export interface DailyStat {
  date: string;
  sentCount: number;
  repliedCount: number;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
}

export interface DateRange {
  preset: DatePreset;
  start: Date;
  end: Date;
}

export interface DerivedMessage {
  id: string;
  leadId: string;
  leadName: string;
  campaignId: string;
  campaignName: string;
  direction: "outbound" | "inbound";
  sentAt: Date;
}
