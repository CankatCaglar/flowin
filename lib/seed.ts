import { defaultCampaignFlow } from "@/lib/campaign-flow";
import { addDays, APP_TODAY, toDateKey } from "@/lib/dates";
import type { Brand, Campaign, CampaignStatus, DailyStat, Lead, LeadStage } from "@/types";

function atDay(offset: number, hours = 10) {
  const date = addDays(APP_TODAY, offset);
  date.setHours(hours, 15, 0, 0);
  return date;
}

function hash(input: string) {
  return input.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function dailySeries(
  brandId: string,
  sentTotal: number,
  repliedTotal: number,
  days = 60,
): DailyStat[] {
  const weights = Array.from({ length: days }, (_, index) => {
    const wave = 0.7 + ((hash(`${brandId}-${index}`) % 70) / 100);
    return wave;
  });
  const weightSum = weights.reduce((sum, value) => sum + value, 0);

  let sentUsed = 0;
  let repliedUsed = 0;

  return weights.map((weight, index) => {
    const isLast = index === days - 1;
    const sentCount = isLast
      ? sentTotal - sentUsed
      : Math.max(0, Math.round((sentTotal * weight) / weightSum));
    const repliedCount = isLast
      ? repliedTotal - repliedUsed
      : Math.max(0, Math.round((repliedTotal * weight) / weightSum));
    sentUsed += sentCount;
    repliedUsed += repliedCount;
    return {
      date: toDateKey(addDays(APP_TODAY, -(days - 1 - index))),
      sentCount,
      repliedCount,
    };
  });
}

export const seedBrands: Brand[] = [
  { id: "bimaks", name: "Bimaks", avatarColor: "#6D1472", createdAt: atDay(-120) },
  { id: "siskon", name: "Siskon", avatarColor: "#2F5F9A", createdAt: atDay(-110) },
  { id: "uniba", name: "UNIBA", avatarColor: "#4A0E5C", createdAt: atDay(-98) },
  { id: "altinok", name: "Altinok", avatarColor: "#C47A1A", createdAt: atDay(-80) },
  { id: "nera", name: "Nera", avatarColor: "#3D0A45", createdAt: atDay(-60) },
];

const rawSeedCampaigns = [
  {
    id: "bimaks-saas",
    brandId: "bimaks",
    name: "SaaS Karar Vericiler",
    status: "active",
    sentCount: 412,
    repliedCount: 176,
    startDate: atDay(-40),
    endDate: atDay(18),
  },
  {
    id: "bimaks-ecom",
    brandId: "bimaks",
    name: "E-ticaret Operasyon",
    status: "active",
    sentCount: 380,
    repliedCount: 186,
    startDate: atDay(-32),
    endDate: atDay(12),
  },
  {
    id: "bimaks-fintech",
    brandId: "bimaks",
    name: "Fintech Outreach",
    status: "expiring",
    sentCount: 456,
    repliedCount: 46,
    startDate: atDay(-28),
    endDate: atDay(2),
  },
  {
    id: "bimaks-cold",
    brandId: "bimaks",
    name: "Kurumsal Soğuk Liste",
    status: "active",
    sentCount: 80,
    repliedCount: 4,
    startDate: atDay(-21),
    endDate: atDay(20),
  },
  {
    id: "bimaks-hr",
    brandId: "bimaks",
    name: "HR Tech Pilot",
    status: "draft",
    sentCount: 0,
    repliedCount: 0,
    startDate: atDay(3),
    endDate: atDay(30),
  },
  {
    id: "siskon-ops",
    brandId: "siskon",
    name: "Operasyon Direktörleri",
    status: "active",
    sentCount: 290,
    repliedCount: 88,
    startDate: atDay(-24),
    endDate: atDay(16),
  },
  {
    id: "siskon-it",
    brandId: "siskon",
    name: "IT Satın Alma",
    status: "expiring",
    sentCount: 210,
    repliedCount: 19,
    startDate: atDay(-20),
    endDate: atDay(1),
  },
  {
    id: "siskon-draft",
    brandId: "siskon",
    name: "Q4 Partnerlik",
    status: "draft",
    sentCount: 0,
    repliedCount: 0,
    startDate: atDay(7),
    endDate: atDay(40),
  },
  {
    id: "uniba-faculty",
    brandId: "uniba",
    name: "Fakülte İşbirliği",
    status: "active",
    sentCount: 340,
    repliedCount: 102,
    startDate: atDay(-36),
    endDate: atDay(14),
  },
  {
    id: "uniba-masters",
    brandId: "uniba",
    name: "Yüksek Lisans Tanıtım",
    status: "active",
    sentCount: 218,
    repliedCount: 54,
    startDate: atDay(-22),
    endDate: atDay(18),
  },
  {
    id: "uniba-alumni",
    brandId: "uniba",
    name: "Mezun Ağırlama",
    status: "completed",
    sentCount: 180,
    repliedCount: 61,
    startDate: atDay(-70),
    endDate: atDay(-8),
  },
  {
    id: "altinok-export",
    brandId: "altinok",
    name: "İhracat Geliştirme",
    status: "active",
    sentCount: 265,
    repliedCount: 71,
    startDate: atDay(-18),
    endDate: atDay(22),
  },
  {
    id: "altinok-low",
    brandId: "altinok",
    name: "Soğuk Üretim Listesi",
    status: "active",
    sentCount: 120,
    repliedCount: 8,
    startDate: atDay(-15),
    endDate: atDay(10),
  },
  {
    id: "nera-agency",
    brandId: "nera",
    name: "Ajans Karar Vericiler",
    status: "active",
    sentCount: 198,
    repliedCount: 64,
    startDate: atDay(-14),
    endDate: atDay(21),
  },
  {
    id: "nera-expire",
    brandId: "nera",
    name: "Yaz Kampanyası",
    status: "expiring",
    sentCount: 156,
    repliedCount: 41,
    startDate: atDay(-25),
    endDate: atDay(2),
  },
];

const audienceByCampaign: Record<string, string> = {
  "bimaks-saas": "SaaS Karar Vericiler",
  "bimaks-ecom": "E-ticaret Profesyonelleri",
  "bimaks-fintech": "Fintech Yöneticileri",
  "bimaks-cold": "Kurumsal Satın Alma",
  "bimaks-hr": "HR Tech Ekipleri",
};

export const seedCampaigns: Campaign[] = rawSeedCampaigns.map((campaign) => ({
  ...campaign,
  status: campaign.status as CampaignStatus,
  createdAt: addDays(campaign.startDate, -1),
  targetAudience: audienceByCampaign[campaign.id] ?? campaign.name,
  leadGoal: campaign.id === "bimaks-ecom" ? 500 : Math.max(campaign.sentCount + 80, 120),
  flow: defaultCampaignFlow(),
}));

const companies = [
  "ModaLine", "RetailCo", "NovaShop", "Pazarama", "TrendKart", "BlueBasket",
  "KiteOps", "NorthPeak", "ViraPay", "AtlasTrade", "LumenTech", "OrbitLabs",
];
const positions = [
  "E-ticaret Yöneticisi", "Operasyon Müdürü", "Dijital Pazarlama Lideri",
  "Satın Alma Uzmanı", "Growth Manager", "CRM Yöneticisi",
];

function stageForLead(status: Lead["status"], index: number): LeadStage {
  if (status === "replied") return index % 2 === 0 ? "replied" : "interested";
  if (status === "in_progress") return index % 2 === 0 ? "first_contact" : "proposal";
  return index % 5 === 0 ? "failed" : "awaiting_reply";
}

const firstNames = [
  "Elif", "Mert", "Ayşe", "Can", "Zeynep", "Emre", "Deniz", "Burak",
  "Selin", "Kaan", "İrem", "Onur", "Ece", "Barış", "Melis", "Tolga",
];
const lastNames = [
  "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk",
  "Arslan", "Doğan", "Koç", "Aslan", "Kurt", "Özdemir", "Polat", "Aksoy",
];

function buildLeads(): Lead[] {
  const leads: Lead[] = [];

  seedCampaigns.forEach((campaign) => {
    if (campaign.status === "draft") return;
    const count = campaign.brandId === "bimaks" ? 12 : 6;

    for (let index = 0; index < count; index += 1) {
      const nameIndex = (hash(campaign.id) + index) % firstNames.length;
      const lastIndex = (hash(campaign.name) + index) % lastNames.length;
      const fullName = `${firstNames[nameIndex]} ${lastNames[lastIndex]}`;
      const isUnresponsive = campaign.brandId === "bimaks" ? index < 5 : index < 2;
      const isReplied = !isUnresponsive && index % 3 !== 0;
      const sentOffset = isUnresponsive ? -(8 + (index % 12)) : -(1 + (index % 6));
      const lastMessageSentAt = atDay(sentOffset, 9 + (index % 8));

      const status = isUnresponsive ? "unresponsive" : isReplied ? "replied" : "in_progress";
      const company = companies[(hash(campaign.id) + index) % companies.length];
      const slug = fullName.toLowerCase().replace(/\s+/g, ".");
      leads.push({
        id: `${campaign.id}-lead-${index + 1}`,
        brandId: campaign.brandId,
        campaignId: campaign.id,
        fullName,
        linkedinUrl: `https://www.linkedin.com/in/${fullName.toLowerCase().replace(/\s+/g, "-")}`,
        status,
        lastMessageSentAt,
        firstReplyReceivedAt: isReplied
          ? addDays(lastMessageSentAt, 1 + (index % 3) + ((index % 2) ? 0.3 : 0.8))
          : undefined,
        company,
        position: positions[(hash(campaign.name) + index) % positions.length],
        stage: stageForLead(status, index),
        email: `${slug}@${company.toLowerCase()}.com`,
        phone: `+90 53${(hash(fullName) % 10)}${(100 + (index * 17) % 90).toString().padStart(2, "0")} ${1000 + (hash(campaign.id + index) % 8000)}`,
      });
    }
  });

  return leads;
}

export const seedLeads = buildLeads();

export const seedDailyStats: Record<string, DailyStat[]> = {
  bimaks: dailySeries("bimaks", 1248, 408),
  siskon: dailySeries("siskon", 500, 107),
  uniba: dailySeries("uniba", 738, 217),
  altinok: dailySeries("altinok", 385, 79),
  nera: dailySeries("nera", 354, 105),
};

export function getSeedBrandStats(brandId: string) {
  const campaigns = seedCampaigns.filter((campaign) => campaign.brandId === brandId);
  const sent = campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0);
  const replied = campaigns.reduce((sum, campaign) => sum + campaign.repliedCount, 0);
  const activeCount = campaigns.filter(
    (campaign) => campaign.status === "active" || campaign.status === "expiring",
  ).length;
  return {
    activeCampaigns: activeCount,
    successRate: sent > 0 ? (replied / sent) * 100 : 0,
  };
}
