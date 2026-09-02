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
      tr: "Merhaba {{firstName}} {{lastName}},\n{{company}}’deki çalışmalarınızı gördüm. Benzer ekiplerle büyüme, satış ve verimlilik tarafında çalışıyoruz. Bağlantıda kalmak isterim.",
      en: "Hi {{firstName}} {{lastName}},\nI came across your work at {{company}}. We work with similar teams on growth, sales and efficiency. I'd like to stay connected.",
    },
  },
  inmail: {
    title: { tr: "InMail", en: "InMail" },
    body: {
      tr: "Merhaba {{firstName}} {{lastName}},\n{{company}} tarafındaki içerik ve büyüme işinizi kısaca konuşmak isterim. Score AI, paylaşımlarınızı 30+ mikro kriterle saniyeler içinde analiz ediyor. Uygun bir 15 dakikalık aralık paylaşabilir misiniz?",
      en: "Hi {{firstName}} {{lastName}},\nI'd like to briefly talk through content and growth at {{company}}. Score AI scores your posts against 30+ micro-criteria in seconds. Could you share a 15-minute slot?",
    },
  },
  respond: {
    title: { tr: "Yanıt Mesajı", en: "Reply Message" },
    body: {
      tr: "Dönüşünüz için teşekkürler {{firstName}}. Score AI ile içeriğinizi ücretsiz analiz etmek veya sorularınızı netleştirmek için bu hafta 15 dakikalık kısa bir görüşme ayarlayalım mı?",
      en: "Thanks for getting back to me, {{firstName}}. Shall we set up a short 15-minute call this week to run a free Score AI analysis or go through your questions?",
    },
  },
  message1: {
    title: { tr: "Mesaj 1", en: "Message 1" },
    body: {
      tr: "Merhaba {{firstName}} {{lastName}},\n\nBağlantı için teşekkürler. Kısa bir not bırakmak istedim: Sosyal medya içerikleriniz/paylaşımlarınız neden beklediğiniz performansı göstermiyor, bunu Score AI saniyeler içinde analiz ediyor.\n\nİçeriğinizi 30+ mikro kriterle değerlendiriyor, markanızı anlıyor ve daha iyi sonuçlar için uygulanabilir öneriler sunuyor. Dilerseniz ücretsiz analiz sayfamızdan içeriğinizi yükleyip skorunuzu hemen görebilirsiniz:",
      en: "Hi {{firstName}} {{lastName}},\n\nThanks for connecting. A quick note: Score AI shows in seconds why your social posts may not be hitting the performance you expected.\n\nIt scores your content against 30+ micro-criteria, understands your brand, and gives practical next steps. If you'd like, upload a post on our free analysis page and see your score right away:",
    },
  },
  message2: {
    title: { tr: "Mesaj 2", en: "Message 2" },
    body: {
      tr: "Merhaba {{firstName}} {{lastName}},\n\nScore AI analizini deneme fırsatınız oldu mu? İçeriğinizi yükleyip 30+ mikro kriterle skorunuzu saniyeler içinde görebilirsiniz. Dilerseniz ücretsiz analiz için bana yazmanız yeterli.",
      en: "Hi {{firstName}} {{lastName}},\n\nDid you get a chance to try the Score AI analysis? Upload a post and see your score against 30+ micro-criteria in seconds. Just reply if you'd like a free review.",
    },
  },
  message3: {
    title: { tr: "Mesaj 3", en: "Message 3" },
    body: {
      tr: "Merhaba {{firstName}} {{lastName}},\nSon kez rahatsız ediyorum. Score AI ile ilgili aklınıza takılan bir şey olursa ya da içeriklerinizi ücretsiz analiz etmek isterseniz dilediğiniz zaman bana yazabilirsiniz.\nİyi günler dilerim.",
      en: "Hi {{firstName}} {{lastName}},\nLast note from me. If anything about Score AI is on your mind, or you'd like a free content analysis, write anytime.\nHave a good day.",
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

export function flowStepCounts(campaign: { stepCounts?: Record<string, number> }, stepId: string) {
  return Math.max(0, Number(campaign.stepCounts?.[stepId] ?? 0));
}

export function flattenFlowSteps(steps: CampaignFlowStep[]) {
  const { trunk, accepted, noResponse, inmailAccepted, inmailNoResponse } =
    splitFlowBranches(steps);
  return [...trunk, ...accepted, ...noResponse, ...inmailAccepted, ...inmailNoResponse];
}
