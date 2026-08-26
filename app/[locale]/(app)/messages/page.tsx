"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { deriveMessages } from "@/lib/messages";
import { formatDate } from "@/lib/utils";

export default function MessagesPage() {
  const t = useTranslations("messages");
  const common = useTranslations("common");
  const locale = useLocale();
  const { selectedBrand } = useBrand();
  const { campaigns, leads, loading } = useBrandData(selectedBrand?.id ?? null);

  const rows = useMemo(
    () => deriveMessages(leads, campaigns),
    [campaigns, leads],
  );

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="surface-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">{t("lead")}</th>
              <th className="px-5 py-3 font-medium">{t("campaign")}</th>
              <th className="px-5 py-3 font-medium">{t("direction")}</th>
              <th className="px-5 py-3 font-medium">{t("time")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((message) => (
              <tr key={message.id} className="border-t border-purple-jam/8">
                <td className="px-5 py-3 font-medium text-ink">{message.leadName}</td>
                <td className="px-5 py-3 text-muted">{message.campaignName}</td>
                <td className="px-5 py-3">
                  <StatusBadge
                    status={message.direction === "inbound" ? "replied" : "waiting_reply"}
                    label={t(message.direction)}
                  />
                </td>
                <td className="px-5 py-3 text-muted">
                  {formatDate(message.sentAt, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">{common("empty")}</p>
        ) : null}
      </div>
    </div>
  );
}
