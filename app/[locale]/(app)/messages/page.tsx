"use client";

import { useTranslations } from "next-intl";
import { MessagesWorkspace } from "@/components/messages/MessagesWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useBrand } from "@/contexts/BrandContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useBrandData } from "@/hooks/useBrandData";

export default function MessagesPage() {
  const t = useTranslations("messages");
  const { selectedBrand } = useBrand();
  const { now } = useDateRange();
  const { messages, leads, campaigns, loading } = useBrandData(selectedBrand?.id ?? null);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <MessagesWorkspace messages={messages} leads={leads} campaigns={campaigns} now={now} />
      )}
    </div>
  );
}
