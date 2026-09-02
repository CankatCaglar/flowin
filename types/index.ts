export type CampaignStatus = "active" | "expiring" | "paused" | "draft" | "completed";
export type LeadStatus =
  | "queued"
  | "waiting_reply"
  | "replied"
  | "failed"
  | "flow_completed";
export type LeadStage =
  | "connection_request"
  | "profile_viewed"
  | "message_1"
  | "message_2"
  | "message_3"
  | "flow_completed";
export type LeadEventKind =
  | "added"
  | "profile_viewed"
  | "connection_sent"
  | "accepted"
  | "message_1_sent"
  | "message_2_sent"
  | "message_3_sent"
  | "inmail_sent"
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

export type UnipileStatus = "none" | "running" | "disconnected" | "error";

export interface BrandPacing {
  dailyInvites: number;
  dailyMessages: number;
  dailyViews: number;
  dailyInmails: number;
}

/** Istanbul wall-clock window. `weekdays` uses ISO 1=Mon … 7=Sun. */
export interface BrandSchedule {
  startHour: number;
  endHour: number;
  weekdays: number[];
}

export interface BrandAlerts {
  connectionLost: boolean;
  sendFailed: boolean;
  lowLeads: boolean;
  dailyCap: boolean;
}

export interface Brand {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: Date;
  linkedinSub?: string;
  linkedinEmail?: string;
  linkedinPublicId?: string;
  avatarUrl?: string;
  unipileAccountId?: string;
  unipileStatus?: UnipileStatus;
  unipileSyncedAt?: Date;
  pacing?: BrandPacing;
  schedule?: BrandSchedule;
  outreachPaused?: boolean;
  testMode?: boolean;
  archived?: boolean;
  alerts?: BrandAlerts;
  activeCampaigns?: number;
  successRate?: number;
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
  stepCounts?: Record<string, number>;
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
  linkedinPublicId?: string;
  unipileProviderId?: string;
  unipileChatId?: string;
  avatarUrl?: string;
  avatarChecked?: boolean;
  status: LeadStatus;
  lastMessageSentAt: Date;
  firstReplyReceivedAt?: Date;
  company: string;
  position: string;
  stage: LeadStage;
  email: string;
  phone: string;
  history: LeadEvent[];
  nextStepId?: string;
  nextStepAt?: Date;
  currentBranch?: FlowBranch | "";
  awaiting?: "connection" | "inmail" | "";
  failReason?: string;
}

export interface DailyStat {
  date: string;
  sentCount: number;
  repliedCount: number;
  views?: number;
  invites?: number;
  messages?: number;
  accepted?: number;
  inmails?: number;
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

export interface OutreachMessage {
  id: string;
  brandId: string;
  campaignId: string;
  campaignName: string;
  leadId: string;
  leadName: string;
  direction: "outbound" | "inbound";
  body: string;
  sentAt: Date;
  unipileMessageId?: string;
}

/** @deprecated Use OutreachMessage */
export type DerivedMessage = OutreachMessage;
