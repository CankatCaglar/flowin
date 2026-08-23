export type CampaignStatus = "active" | "expiring" | "draft" | "completed";
export type LeadStatus = "unresponsive" | "replied" | "in_progress";
export type DatePreset = "last7" | "thisMonth" | "custom";
export type ChartMetric = "successRate" | "sent" | "replied";

export interface Brand {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: Date;
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
