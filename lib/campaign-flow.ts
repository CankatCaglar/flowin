import type { CampaignFlowStep, FlowDelayUnit } from "@/types";

export const FLOW_VARIABLES = [
  "firstName",
  "lastName",
  "company",
  "position",
] as const;

export function defaultCampaignFlow(): CampaignFlowStep[] {
  return [
    {
      id: "step-invite",
      kind: "connection",
      title: "Connection Request",
      body: "Merhaba {{firstName}}, {{company}} bünyesindeki operasyonlarınızı yakından takip ediyoruz. Kısa bir bağlantı kurmak isterim.",
      delayDays: 0,
      delayUnit: "days",
    },
    {
      id: "step-message-1",
      kind: "message",
      title: "Message 1",
      body: "Merhaba {{firstName}}, bağlantımız için teşekkürler. {{position}} rolündeki ekiplerin e-ticaret operasyonunu nasıl ölçeklediğini merak ediyoruz.",
      delayDays: 1,
      delayUnit: "days",
    },
    {
      id: "step-message-2",
      kind: "message",
      title: "Message 2",
      body: "Merhaba {{firstName}}, {{company}} tarafında benzer ekiplerle çalışırken sipariş, stok ve müşteri deneyimini tek akışta toplayan bir operasyon modeli paylaşıyoruz. 15 dakikalık kısa bir görüşme uygun olur mu?",
      delayDays: 3,
      delayUnit: "days",
    },
    {
      id: "step-message-3",
      kind: "message",
      title: "Message 3",
      body: "{{firstName}}, son olarak ilgili örnekleri iletmek isterim. Uygun olduğunuz bir günü paylaşırsanız takvime yerleştirebilirim.",
      delayDays: 5,
      delayUnit: "days",
    },
  ];
}

export function flowDurationHours(steps: CampaignFlowStep[]) {
  return steps.slice(1).reduce((sum, step) => {
    const amount = Math.max(0, step.delayDays);
    return sum + (step.delayUnit === "hours" ? amount : amount * 24);
  }, 0);
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
