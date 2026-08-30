"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Link2, List, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { LinkedInIcon } from "@/components/brand/LinkedInIcon";
import { CreateCampaignSidebar } from "@/components/campaigns/CreateCampaignSidebar";
import { CreateFlowCanvas } from "@/components/campaigns/CreateFlowCanvas";
import { EditFlowStepModal } from "@/components/campaigns/EditFlowStepModal";
import { LeadImportPanel } from "@/components/campaigns/LeadImportPanel";
import { LeadListPicker } from "@/components/campaigns/LeadListPicker";
import { LeadUrlPanel } from "@/components/campaigns/LeadUrlPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { useRouter } from "@/i18n/navigation";
import { defaultCampaignFlow } from "@/lib/campaign-flow";
import type { ImportedLead } from "@/lib/lead-import";
import { createCampaign, importSalesNavLeads } from "@/lib/outreach-api";
import { cn } from "@/lib/utils";
import type { CampaignFlowStep } from "@/types";

const LIST_SOURCES = ["existing", "file", "salesNav", "urls"] as const;

function usesImported(source: (typeof LIST_SOURCES)[number]) {
  return source === "file" || source === "salesNav" || source === "urls";
}

function sourceLabelKey(source: (typeof LIST_SOURCES)[number]) {
  if (source === "existing") return "existingList";
  if (source === "file") return "file";
  if (source === "salesNav") return "salesNav";
  return "profileUrl";
}

export default function NewCampaignPage() {
  const t = useTranslations("campaigns.create");
  const campaignsT = useTranslations("campaigns");
  const { selectedBrand } = useBrand();
  const { campaigns, refresh } = useBrandData(selectedBrand?.id ?? null);
  const router = useRouter();
  const preferredList = campaigns[0];
  const [name, setName] = useState("");
  const [source, setSource] = useState<(typeof LIST_SOURCES)[number]>("existing");
  const [listId, setListId] = useState("");
  const [imported, setImported] = useState<{
    leads: ImportedLead[];
    fileName: string;
    skipped: number;
  }>({ leads: [], fileName: "", skipped: 0 });
  const [salesUrl, setSalesUrl] = useState("");
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [flow, setFlow] = useState<CampaignFlowStep[]>(() => defaultCampaignFlow());
  const [editing, setEditing] = useState<CampaignFlowStep | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedList = useMemo(
    () => campaigns.find((campaign) => campaign.id === listId) ?? preferredList,
    [campaigns, listId, preferredList],
  );

  useEffect(() => {
    if (!listId && preferredList) setListId(preferredList.id);
  }, [listId, preferredList]);

  const outreachReady = selectedBrand?.unipileStatus === "running";
  const shownCount = usesImported(source)
    ? imported.leads.length
    : source === "existing"
      ? selectedList?.leadGoal ?? 0
      : 0;
  const canSubmit =
    Boolean(name.trim()) &&
    (source === "existing" ? Boolean(selectedList) : usesImported(source) ? imported.leads.length > 0 : false);

  const save = async (asDraft: boolean) => {
    if (!selectedBrand || !name.trim() || !canSubmit) return;
    setSubmitting(true);
    try {
      const createdAt = new Date();
      const campaign = await createCampaign({
        brandId: selectedBrand.id,
        name: name.trim(),
        startDate: createdAt,
        endDate: createdAt,
        targetAudience: usesImported(source)
          ? imported.fileName || name.trim()
          : selectedList?.name ?? name.trim(),
        leadGoal: shownCount,
        flow,
        status: asDraft ? "draft" : "active",
        copyFromCampaignId: source === "existing" ? selectedList?.id : undefined,
        leads: usesImported(source) ? imported.leads : undefined,
      });
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
        ? imported.fileName
          ? t("summaryFromFile", { name: imported.fileName })
          : t("summaryNeedSalesNav")
        : source === "urls"
          ? imported.leads.length > 0
            ? t("summaryFromFile", { name: t("profileUrl") })
            : t("summaryNeedProfileUrl")
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
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_minmax(0,1fr)]">
        <div className="surface-card flex h-full min-h-0 flex-col gap-8 rounded-2xl p-5 sm:p-6 xl:row-span-2">
          <section className="space-y-4">
            <h2 className="font-display text-base font-semibold text-ink">
              1. {t("info")}
            </h2>
            <Input
              id="campaign-name"
              variant="light"
              label={t("name")}
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
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
                  onClick={() => {
                    if (item !== source) {
                      setImported({ leads: [], fileName: "", skipped: 0 });
                      setSalesError(null);
                    }
                    setSource(item);
                  }}
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
                  {item === "urls" ? <Link2 className="h-4 w-4" /> : null}
                  {t(sourceLabelKey(item))}
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
            {source === "urls" && selectedBrand ? (
              <LeadUrlPanel
                brandId={selectedBrand.id}
                leads={imported.leads}
                onChange={(leads) => setImported({ leads, fileName: t("profileUrl"), skipped: 0 })}
              />
            ) : null}
            {source === "salesNav" ? (
              <div className="space-y-3">
                {outreachReady ? (
                  <>
                    <p className="text-sm leading-6 text-muted">{t("salesNavHint")}</p>
                    <Input
                      id="sales-nav-url"
                      variant="light"
                      label={t("salesNavUrl")}
                      placeholder="https://www.linkedin.com/sales/search/people..."
                      value={salesUrl}
                      onChange={(event) => setSalesUrl(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="brand"
                      disabled={salesLoading || !salesUrl.trim()}
                      onClick={async () => {
                        if (!selectedBrand) return;
                        setSalesLoading(true);
                        setSalesError(null);
                        try {
                          const result = await importSalesNavLeads(selectedBrand.id, salesUrl.trim());
                          setImported({
                            leads: result.leads.map((lead) => ({
                              fullName: lead.fullName,
                              linkedinUrl: lead.linkedinUrl,
                              company: lead.company,
                              position: lead.position,
                              email: "",
                              phone: "",
                              unipileProviderId: lead.unipileProviderId,
                            })),
                            fileName: t("salesNav"),
                            skipped: 0,
                          });
                          if (result.leads.length === 0) setSalesError("empty");
                        } catch (error) {
                          setSalesError(error instanceof Error ? error.message : "import-failed");
                        } finally {
                          setSalesLoading(false);
                        }
                      }}
                    >
                      {salesLoading ? t("salesNavLoading") : t("salesNavImport")}
                    </Button>
                    {imported.leads.length > 0 ? (
                      <p className="text-sm text-ink">{t("importReady", { count: imported.leads.length })}</p>
                    ) : null}
                    {salesError ? (
                      <p className="text-sm text-rose-600">
                        {salesError === "empty" ? t("salesNavEmpty") : t("salesNavFailed")}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm leading-6 text-muted">{t("salesNavNeedOutreach")}</p>
                )}
              </div>
            ) : null}
          </section>

          <section className="flex min-h-0 flex-1 flex-col space-y-2">
            <div className="shrink-0">
              <h2 className="font-display text-base font-semibold text-ink">
                3. {t("flow")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">{t("flowHint")}</p>
            </div>
            <div className="min-h-0 flex-1">
              <CreateFlowCanvas
                steps={flow}
                selectedId={editing?.id ?? selectedId}
                onSelect={(step) => {
                  setSelectedId(step.id);
                  setEditing(step);
                }}
              />
            </div>
          </section>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 pt-2">
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
        <CreateCampaignSidebar
          leadCount={shownCount}
          steps={flow}
          sourceLabel={sourceLabel}
        />
      </div>
      {editing ? (
        <EditFlowStepModal
          key={editing.id}
          step={editing}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setFlow((current) => current.map((step) => (step.id === next.id ? next : step)));
          }}
        />
      ) : null}
    </form>
  );
}
