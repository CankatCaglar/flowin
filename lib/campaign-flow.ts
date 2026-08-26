import type { CampaignFlowStep, FlowBranch, FlowDelayUnit } from "@/types";

export const FLOW_VARIABLES = [
  "firstName",
  "lastName",
  "company",
  "position",
] as const;

/**
 * Built-in copy for the default flow. Kept in code instead of the message
 * catalogue because the bodies contain `{{variable}}` tokens that ICU would
 * try to parse as placeholders.
 */
const STEP_TEMPLATES: Record<
  string,
  { title: { tr: string; en: string }; body: { tr: string; en: string } }
> = {
  viewProfile: {
    title: { tr: "Profili Görüntüle", en: "View Profile" },
    body: {
      tr: "{{firstName}} profilini ziyaret et, son paylaşımlarını ve rolünü not al.",
      en: "Visit {{firstName}}'s profile and note their recent posts and role.",
    },
  },
  connectionRequest: {
    title: { tr: "Bağlantı İsteği", en: "Connection Request" },
    body: {
      tr: "Merhaba {{firstName}}, {{company}} bünyesindeki operasyonlarınızı yakından takip ediyoruz. Kısa bir bağlantı kurmak isterim.",
      en: "Hi {{firstName}}, we follow the work your team does at {{company}} closely. I'd love to connect.",
    },
  },
  inmail: {
    title: { tr: "InMail", en: "InMail" },
    body: {
      tr: "Merhaba {{firstName}}, {{company}} tarafındaki operasyonu kısaca konuşmak isterim. Uygun bir 15 dakikalık aralık paylaşabilir misiniz?",
      en: "Hi {{firstName}}, I'd like to briefly talk through operations at {{company}}. Could you share a 15-minute slot that works for you?",
    },
  },
  respond: {
    title: { tr: "Yanıt Mesajı", en: "Reply Message" },
    body: {
      tr: "Dönüşünüz için teşekkürler {{firstName}}. Sorularınızı netleştirmek için bu hafta 15 dakikalık kısa bir görüşme ayarlayalım mı?",
      en: "Thanks for getting back to me, {{firstName}}. Shall we set up a short 15-minute call this week to go through your questions?",
    },
  },
  message1: {
    title: { tr: "Mesaj 1", en: "Message 1" },
    body: {
      tr: "Merhaba {{firstName}}, bağlantımız için teşekkürler. {{position}} rolündeki ekiplerin e-ticaret operasyonunu nasıl ölçeklediğini merak ediyoruz.",
      en: "Hi {{firstName}}, thanks for connecting. We're curious how teams in a {{position}} role scale their e-commerce operation.",
    },
  },
  message2: {
    title: { tr: "Mesaj 2", en: "Message 2" },
    body: {
      tr: "Merhaba {{firstName}}, {{company}} tarafında benzer ekiplerle çalışırken sipariş, stok ve müşteri deneyimini tek akışta toplayan bir operasyon modeli paylaşıyoruz. 15 dakikalık kısa bir görüşme uygun olur mu?",
      en: "Hi {{firstName}}, with teams like yours at {{company}} we share an operating model that brings orders, stock and customer experience into a single flow. Would a short 15-minute call work?",
    },
  },
  message3: {
    title: { tr: "Mesaj 3", en: "Message 3" },
    body: {
      tr: "{{firstName}}, son olarak ilgili örnekleri iletmek isterim. Uygun olduğunuz bir günü paylaşırsanız takvime yerleştirebilirim.",
      en: "{{firstName}}, one last note — I'd like to send over a few relevant examples. Share a day that suits you and I'll get it on the calendar.",
    },
  },
};

type TemplateLocale = "tr" | "en";

function templateLocale(locale: string): TemplateLocale {
  return locale.startsWith("tr") ? "tr" : "en";
}

/** Localised step title, falling back to the stored value once a user edits it. */
export function flowStepTitle(step: CampaignFlowStep, locale: string) {
  const template = step.templateKey ? STEP_TEMPLATES[step.templateKey] : undefined;
  return template ? template.title[templateLocale(locale)] : step.title;
}

/** Localised step body, falling back to the stored value once a user edits it. */
export function flowStepBody(step: CampaignFlowStep, locale: string) {
  const template = step.templateKey ? STEP_TEMPLATES[step.templateKey] : undefined;
  return template ? template.body[templateLocale(locale)] : step.body;
}

function templateStep(
  id: string,
  templateKey: keyof typeof STEP_TEMPLATES,
  rest: Omit<CampaignFlowStep, "id" | "title" | "body" | "templateKey">,
): CampaignFlowStep {
  return {
    id,
    templateKey,
    title: STEP_TEMPLATES[templateKey].title.en,
    body: STEP_TEMPLATES[templateKey].body.en,
    ...rest,
  };
}

export function defaultCampaignFlow(): CampaignFlowStep[] {
  return [
    templateStep("step-view-1", "viewProfile", {
      kind: "profile_view",
      delayDays: 0,
      delayUnit: "days",
    }),
    templateStep("step-invite", "connectionRequest", {
      kind: "connection",
      delayDays: 1,
      delayUnit: "days",
    }),
    templateStep("step-accepted-message-1", "message1", {
      kind: "message",
      delayDays: 1,
      delayUnit: "days",
      branch: "accepted",
    }),
    templateStep("step-accepted-view", "viewProfile", {
      kind: "profile_view",
      delayDays: 1,
      delayUnit: "days",
      branch: "accepted",
    }),
    templateStep("step-accepted-message-2", "message2", {
      kind: "message",
      delayDays: 1,
      delayUnit: "days",
      branch: "accepted",
    }),
    templateStep("step-accepted-view-2", "viewProfile", {
      kind: "profile_view",
      delayDays: 1,
      delayUnit: "days",
      branch: "accepted",
    }),
    templateStep("step-accepted-message-3", "message3", {
      kind: "message",
      delayDays: 1,
      delayUnit: "days",
      branch: "accepted",
    }),
    templateStep("step-silent-view", "viewProfile", {
      kind: "profile_view",
      delayDays: 1,
      delayUnit: "days",
      branch: "no_response",
    }),
    templateStep("step-silent-inmail", "inmail", {
      kind: "inmail",
      delayDays: 1,
      delayUnit: "days",
      branch: "no_response",
      premium: true,
    }),
    templateStep("step-inmail-reply", "respond", {
      kind: "message",
      delayDays: 0,
      delayUnit: "days",
      branch: "inmail_accepted",
    }),
    templateStep("step-inmail-silent-view", "viewProfile", {
      kind: "profile_view",
      delayDays: 1,
      delayUnit: "days",
      branch: "inmail_no_response",
    }),
  ];
}

export interface FlowBranches {
  trunk: CampaignFlowStep[];
  accepted: CampaignFlowStep[];
  noResponse: CampaignFlowStep[];
  inmailAccepted: CampaignFlowStep[];
  inmailNoResponse: CampaignFlowStep[];
}

/** Splits a stored flow into the shared trunk and each reaction path. */
export function splitFlowBranches(steps: CampaignFlowStep[]): FlowBranches {
  return {
    trunk: steps.filter((step) => !step.branch),
    accepted: steps.filter((step) => step.branch === "accepted"),
    noResponse: steps.filter((step) => step.branch === "no_response"),
    inmailAccepted: steps.filter((step) => step.branch === "inmail_accepted"),
    inmailNoResponse: steps.filter((step) => step.branch === "inmail_no_response"),
  };
}

export const FLOW_BRANCHES: FlowBranch[] = [
  "accepted",
  "no_response",
  "inmail_accepted",
  "inmail_no_response",
];

function branchHours(steps: CampaignFlowStep[]) {
  return steps.reduce((sum, step) => {
    const amount = Math.max(0, step.delayDays);
    return sum + (step.delayUnit === "hours" ? amount : amount * 24);
  }, 0);
}

export function flowDurationHours(steps: CampaignFlowStep[]) {
  const { trunk, accepted, noResponse, inmailAccepted, inmailNoResponse } =
    splitFlowBranches(steps);
  const silentPath =
    branchHours(noResponse) +
    Math.max(branchHours(inmailAccepted), branchHours(inmailNoResponse));
  return branchHours(trunk.slice(1)) + Math.max(branchHours(accepted), silentPath);
}

export function flowDurationDays(steps: CampaignFlowStep[]) {
  return flowDurationHours(steps) / 24;
}

export function waitBadgeKey(unit?: FlowDelayUnit) {
  return unit === "hours" ? "waitBadgeHours" : "waitBadge";
}

export function flowStepCounts(sentCount: number, stepCount: number) {
  return Array.from({ length: stepCount }, (_, index) => {
    const ratio = Math.max(0.18, 1 - index * 0.22);
    return Math.max(0, Math.round(sentCount * ratio));
  });
}

export function flattenFlowSteps(steps: CampaignFlowStep[]) {
  const { trunk, accepted, noResponse, inmailAccepted, inmailNoResponse } =
    splitFlowBranches(steps);
  return [...trunk, ...accepted, ...noResponse, ...inmailAccepted, ...inmailNoResponse];
}
