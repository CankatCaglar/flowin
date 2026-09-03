"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Pencil, Plus, Search, Trash2, TrendingUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FlowinLogo } from "@/components/brand/FlowinLogo";
import { LinkedInIcon } from "@/components/brand/LinkedInIcon";
import { BrandAvatar } from "@/components/brands/BrandAvatar";
import { BrandFormModal } from "@/components/brands/BrandFormModal";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { UserMenu } from "@/components/layout/UserMenu";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useBrand } from "@/contexts/BrandContext";
import { useRouter } from "@/i18n/navigation";
import { cn, EMPTY_METRIC, formatPercent } from "@/lib/utils";
import type { Brand } from "@/types";

export default function BrandsPage() {
  return (
    <Suspense fallback={<BrandsFallback />}>
      <BrandsPageInner />
    </Suspense>
  );
}

function BrandsFallback() {
  const t = useTranslations("common");
  return (
    <div className="flex h-full items-center justify-center bg-midnight text-sm text-white/50">
      {t("loading")}
    </div>
  );
}

function BrandCardSkeletons() {
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={`brand-skeleton-${index}`}
          className="admin-card animate-pulse rounded-2xl p-5"
          aria-hidden
        >
          <div className="mx-auto h-16 w-16 rounded-full bg-white/10" />
          <div className="mx-auto mt-4 h-4 w-24 rounded bg-white/10" />
          <div className="mx-auto mt-2 h-3 w-16 rounded bg-white/5" />
          <div className="mx-auto mt-4 h-3 w-28 rounded bg-white/5" />
          <div className="mx-auto mt-2 h-3 w-20 rounded bg-white/5" />
          <div className="mx-auto mt-5 h-7 w-32 rounded-lg bg-white/5" />
        </div>
      ))}
    </>
  );
}

function BrandsPageInner() {
  const t = useTranslations("brands");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { brands, loading, failed, selectBrand, editBrand, removeBrand, refresh } = useBrand();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    searchParams.get("linkedin") ?? searchParams.get("unipile"),
  );
  const noticeKind = searchParams.get("unipile")
    ? "unipile"
    : searchParams.get("linkedin")
      ? "linkedin"
      : null;

  const filtered = useMemo(
    () =>
      brands.filter((brand) => {
        const term = query.trim().toLocaleLowerCase(locale);
        if (!term) return true;
        return [brand.name, brand.linkedinCompany ?? ""]
          .join(" ")
          .toLocaleLowerCase(locale)
          .includes(term);
      }),
    [brands, locale, query],
  );

  const pendingRetry = useRef(false);

  useEffect(() => {
    setNotice(searchParams.get("linkedin") ?? searchParams.get("unipile"));
  }, [searchParams]);

  useEffect(() => {
    if (loading || pendingRetry.current) return;
    if (searchParams.get("unipile") !== "pending") return;
    pendingRetry.current = true;
    void refresh();
  }, [loading, refresh, searchParams]);

  useEffect(() => {
    if (searchParams.get("unipile") !== "pending") return;
    if (brands.some((brand) => brand.unipileStatus === "running")) {
      setNotice("connected");
    }
  }, [brands, searchParams]);

  const noticeText =
    noticeKind === "unipile"
      ? notice === "connected"
        ? t("outreachConnected")
        : notice === "pending"
          ? t("outreachPending")
          : notice === "denied"
            ? t("outreachDenied")
            : notice === "config"
              ? t("outreachConfig")
              : notice === "error"
                ? t("outreachError")
                : null
      : notice === "already"
        ? t("alreadyConnected")
        : notice === "denied"
          ? t("connectDenied")
          : notice === "config"
            ? t("connectConfig")
            : notice === "scope"
              ? t("connectScope")
              : notice === "firebase"
                ? t("firebaseUnconfigured")
                : notice === "photo"
                  ? t("photoUpdated")
                  : notice === "nophoto"
                    ? t("photoMissing")
                    : notice === "error"
                      ? t("connectError")
                      : null;

  return (
    <RouteGuard requireAuth tone="dark">
      <div className="h-full overflow-y-auto bg-midnight px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex w-full items-center justify-between">
          <FlowinLogo height={36} />
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="dark" />
            <UserMenu variant="dark" />
          </div>
        </header>

        <div className="mt-10 w-full text-center sm:mt-12">
          <h1 className="text-[28px] font-semibold tracking-tight text-white">{t("title")}</h1>
          <p className="mt-2 text-[13px] leading-6 text-white/50">{t("subtitle")}</p>
          <label className="relative mx-auto mt-8 block w-full max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-11 w-full rounded-xl border border-purple-jam/40 bg-midnight/90 px-11 text-sm text-white placeholder:text-white/35 outline-none focus:border-purple-jam/80"
            />
          </label>
          {noticeText ? (
            <p className="mx-auto mt-4 max-w-2xl text-sm text-amber-200/90">{noticeText}</p>
          ) : null}
        </div>

        <div className="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {loading ? <BrandCardSkeletons /> : null}
          {loading ? null : filtered.map((brand) => {
            const stats = {
              activeCampaigns: brand.activeCampaigns ?? 0,
              successRate: brand.successRate ?? 0,
            };
            const outreachOn = brand.unipileStatus === "running";
            return (
              <article
                key={brand.id}
                className="admin-card animate-rise rounded-2xl p-5 text-center"
              >
                <button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    selectBrand(brand.id);
                    router.push("/dashboard");
                  }}
                >
                  <BrandAvatar
                    key={`${brand.id}-${brand.avatarUrl ?? ""}`}
                    brand={brand}
                    size="lg"
                    fetchPriority="high"
                    className="mx-auto"
                  />
                  <h2 className="mt-4 text-lg font-semibold text-white">{brand.name}</h2>
                  <p className="mt-1 truncate text-[12px] text-white/45">
                    {brand.linkedinCompany || EMPTY_METRIC}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-white/60">
                    <LinkedInIcon className="h-3.5 w-3.5" />
                    {t("connected")}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-white/50">
                    {outreachOn ? t("outreachOn") : t("outreachOff")}
                  </p>
                  <div className="mx-auto mt-3 flex w-max flex-col items-start gap-1 text-xs text-white/65">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                      {t("activeCampaigns", { count: stats.activeCampaigns })}
                    </span>
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                      {t("success", {
                        rate: formatPercent(stats.successRate, locale),
                      })}
                    </span>
                  </div>
                </button>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      window.location.assign(
                        `/api/unipile/start?locale=${locale}&brand=${encodeURIComponent(brand.id)}`,
                      );
                    }}
                  >
                    {outreachOn
                      ? t("outreachReconnect")
                      : brand.unipileStatus === "disconnected"
                        ? t("outreachReconnect")
                        : t("outreachConnect")}
                  </button>
                  <button
                    type="button"
                    aria-label={common("edit")}
                    className="rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setEditing(brand);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("delete")}
                    className="rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-rose-200"
                    onClick={() => {
                      setDeleteError(false);
                      setDeleting(brand);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className={cn(
              "admin-card flex flex-col items-center justify-center rounded-2xl p-5 text-center hover:border-purple-jam/60",
              loading && "hidden",
            )}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-purple-jam/60 text-barney">
              <Plus className="h-6 w-6" />
            </span>
            <span className="mt-4 block text-lg font-semibold text-white">{t("addTitle")}</span>
            <span className="mt-1 block text-sm text-white/50">{t("addSubtitle")}</span>
          </button>
        </div>

        {failed ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-center text-sm text-amber-200/90">{t("loadFailed")}</p>
            <Button variant="ghost" onClick={() => void refresh()}>
              {common("retry")}
            </Button>
          </div>
        ) : null}

        {!loading && !failed && brands.length === 0 ? (
          <p className="mt-8 text-center text-sm text-white/50">{t("emptyList")}</p>
        ) : null}

        {!loading && !failed && brands.length > 0 && filtered.length === 0 ? (
          <p className="mt-8 text-center text-sm text-white/50">{t("emptySearch")}</p>
        ) : null}

        <BrandFormModal
          open={modalOpen}
          brand={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSubmit={async (input) => {
            if (!editing) return;
            await editBrand(editing.id, input);
          }}
          onRefreshPhoto={() => {
            window.location.assign(`/api/linkedin/start?locale=${locale}`);
          }}
        />

        <Modal
          open={connectOpen}
          title={t("connectTitle")}
          onClose={() => setConnectOpen(false)}
        >
          <p className="text-sm leading-6 text-white/70">{t("connectBody")}</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConnectOpen(false)}>
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                window.location.assign(`/api/linkedin/start?locale=${locale}`);
              }}
            >
              {t("connectContinue")}
            </Button>
          </div>
        </Modal>

        <Modal
          open={Boolean(deleting)}
          title={t("deleteConfirmTitle")}
          onClose={() => {
            if (!removing) {
              setDeleting(null);
              setDeleteError(false);
            }
          }}
        >
          <p className="text-sm text-white/70">
            {t("deleteConfirm", { name: deleting?.name ?? "" })}
          </p>
          {deleteError ? (
            <p className="mt-3 text-sm text-amber-200/90">{t("deleteFailed")}</p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={removing}
              onClick={() => {
                setDeleting(null);
                setDeleteError(false);
              }}
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={removing}
              onClick={async () => {
                if (!deleting) return;
                setRemoving(true);
                setDeleteError(false);
                try {
                  await removeBrand(deleting.id);
                  setDeleting(null);
                } catch {
                  setDeleteError(true);
                } finally {
                  setRemoving(false);
                }
              }}
            >
              {t("delete")}
            </Button>
          </div>
        </Modal>
      </div>
    </RouteGuard>
  );
}
