"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Calendar, List, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { LinkedInIcon } from "@/components/brand/LinkedInIcon";
import { CreateCampaignSidebar } from "@/components/campaigns/CreateCampaignSidebar";
import { LeadImportPanel } from "@/components/campaigns/LeadImportPanel";
import { LeadListPicker } from "@/components/campaigns/LeadListPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { useRouter } from "@/i18n/navigation";
import { defaultCampaignFlow } from "@/lib/campaign-flow";
import type { ImportedLead } from "@/lib/lead-import";
import { createCampaign, createLead } from "@/lib/local-data";
import { APP_TODAY, addDays, parseDateKey } from "@/lib/dates";
import { cn, toInputDate } from "@/lib/utils";

const LIST_SOURCES = ["existing", "file", "salesNav"] as const;

export default function NewCampaignPage() {
  const t = useTranslations("campaigns.create");
  const campaignsT = useTranslations("campaigns");
  const { selectedBrand } = useBrand();
  const { campaigns, refresh } = useBrandData(selectedBrand?.id ?? null);
  const router = useRouter();
  const preferredList = campaigns[0];
  const [name, setName] = useState("");
  const [start, setStart] = useState(toInputDate(addDays(APP_TODAY, -9)));
  const [end, setEnd] = useState(toInputDate(addDays(APP_TODAY, 18)));
  const [source, setSource] = useState<(typeof LIST_SOURCES)[number]>("existing");
  const [listId, setListId] = useState("");
  const [imported, setImported] = useState<{
    leads: ImportedLead[];
    fileName: string;
    skipped: number;
  }>({ leads: [], fileName: "", skipped: 0 });
  const [submitting, setSubmitting] = useState(false);

  const selectedList = useMemo(
    () => campaigns.find((campaign) => campaign.id === listId) ?? preferredList,
    [campaigns, listId, preferredList],
  );

  useEffect(() => {
    if (!listId && preferredList) setListId(preferredList.id);
  }, [listId, preferredList]);

  const shownCount =
    source === "file"
      ? imported.leads.length
      : source === "existing"
        ? selectedList?.leadGoal ?? 0
        : 0;
  const canSubmit =
    Boolean(name.trim()) &&
    (source === "existing" ? Boolean(selectedList) : source === "file" ? imported.leads.length > 0 : false);

  const save = async (asDraft: boolean) => {
    if (!selectedBrand || !name.trim() || !canSubmit) return;
    setSubmitting(true);
    try {
      const campaign = await createCampaign({
        brandId: selectedBrand.id,
        name: name.trim(),
        startDate: parseDateKey(start),
        endDate: parseDateKey(end),
        targetAudience:
          source === "file"
            ? imported.fileName
            : selectedList?.name ?? name.trim(),
        leadGoal: shownCount,
        flow: defaultCampaignFlow(),
        status: asDraft ? "draft" : "active",
      });
      if (source === "file") {
        for (const lead of imported.leads) {
          await createLead({
            brandId: selectedBrand.id,
            campaignId: campaign.id,
            ...lead,
          });
        }
      }
      refresh();
      router.push(`/campaigns/${campaign.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save(false);
  };

  const sourceLabel =
    source === "file"
      ? imported.fileName
        ? t("summaryFromFile", { name: imported.fileName })
        : t("summaryNeedFile")
      : source === "salesNav"
        ? t("salesNavHint")
        : selectedList
          ? t("summaryFromList", { name: selectedList.name })
          : t("summaryNeedList");

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        backHref="/campaigns"
        backLabel={campaignsT("backToList")}
      />
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="surface-card flex h-full flex-col space-y-8 rounded-2xl p-5 sm:p-6">
          <section className="space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">
              1. {t("info")}
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                id="campaign-name"
                variant="light"
                label={t("name")}
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <Input
                id="campaign-start"
                variant="light"
                type="date"
                label={t("start")}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                leftIcon={<Calendar className="h-4 w-4 text-barney" />}
                required
              />
              <Input
                id="campaign-end"
                variant="light"
                type="date"
                label={t("end")}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                leftIcon={<Calendar className="h-4 w-4 text-barney" />}
                required
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">
              2. {t("lists")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {LIST_SOURCES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSource(item)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
                    source === item
                      ? "border-barney bg-barney/5 text-barney"
                      : "border-purple-jam/15 bg-white text-muted hover:border-barney/30",
                  )}
                >
                  {item === "existing" ? <List className="h-4 w-4" /> : null}
                  {item === "file" ? <Upload className="h-4 w-4" /> : null}
                  {item === "salesNav" ? <LinkedInIcon className="h-4 w-4" /> : null}
                  {t(item === "existing" ? "existingList" : item === "file" ? "file" : "salesNav")}
                </button>
              ))}
            </div>
            {source === "existing" ? (
              selectedList ? (
                <LeadListPicker
                  campaigns={campaigns}
                  selected={selectedList}
                  leadCount={shownCount}
                  onSelect={setListId}
                />
              ) : (
                <p className="text-sm text-muted">{t("noExistingLists")}</p>
              )
            ) : null}
            {source === "file" ? (
              <LeadImportPanel
                leads={imported.leads}
                fileName={imported.fileName}
                skipped={imported.skipped}
                onParsed={setImported}
              />
            ) : null}
            {source === "salesNav" ? (
              <p className="text-sm leading-6 text-muted">{t("salesNavHint")}</p>
            ) : null}
          </section>

          <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="brand"
              disabled={submitting || !canSubmit}
              onClick={() => void save(true)}
            >
              {t("saveDraft")}
            </Button>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {t("submit")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CreateCampaignSidebar leadCount={shownCount} sourceLabel={sourceLabel} />
      </div>
    </form>
  );
}
