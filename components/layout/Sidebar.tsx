"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronUp,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { FlowinLogo } from "@/components/brand/FlowinLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/contexts/BrandContext";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "flowin.sidebarCollapsed";

const items = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard },
  { href: "/campaigns", key: "campaigns", icon: Rocket },
  { href: "/leads", key: "leads", icon: Users },
  { href: "/messages", key: "messages", icon: MessageSquare },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const t = useTranslations("nav");
  const role = useTranslations("auth");
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { selectBrand } = useBrand();
  const router = useRouter();
  const { open, toggle: toggleUserMenu, close } = useMenu("sidebar-user");
  const userMenuRef = useRef<HTMLDivElement>(null);
  useDismissable(userMenuRef, open, close);
  const [collapsed, setCollapsed] = useState(false);
  const [autoNarrow, setAutoNarrow] = useState(false);
  const [contentTight, setContentTight] = useState(false);
  const [forceExpand, setForceExpand] = useState(false);
  const tightAtWidth = useRef(0);
  const lastWidth = useRef(0);
  const skipOverflowPass = useRef(true);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    const query = window.matchMedia("(max-width: 1279px)");
    const apply = () => {
      setAutoNarrow(query.matches);
      if (!query.matches) setForceExpand(false);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    lastWidth.current = window.innerWidth;
    const apply = () => {
      const width = window.innerWidth;
      const shrinking = width < lastWidth.current - 8;
      lastWidth.current = width;
      if (skipOverflowPass.current) {
        skipOverflowPass.current = false;
        return;
      }
      const overflowing = main.scrollWidth > main.clientWidth + 8;
      const cramped = main.clientWidth < 1100;
      if (shrinking && (overflowing || cramped)) {
        tightAtWidth.current = width;
        setContentTight(true);
        return;
      }
      if (tightAtWidth.current && width >= tightAtWidth.current + 160) {
        setContentTight(false);
      }
    };
    const observer = new ResizeObserver(apply);
    observer.observe(main);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  const rail = collapsed || ((autoNarrow || contentTight) && !forceExpand);

  const toggle = () => {
    if ((autoNarrow || contentTight) && !collapsed) {
      setForceExpand((current) => !current);
      return;
    }
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-midnight text-white",
        "fixed inset-y-0 left-0 z-50 w-[min(16.5rem,86vw)] transition-transform duration-200",
        "lg:static lg:z-auto lg:transition-[width]",
        rail ? "lg:w-[72px]" : "lg:w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div
        className={cn(
          "flex h-app-header shrink-0 items-center justify-between px-4",
          rail && "lg:justify-center lg:px-2",
        )}
      >
        <Link
          href="/dashboard"
          className={cn("shrink-0", rail && "lg:hidden")}
          title={t("overview")}
          onClick={onMobileClose}
        >
          <FlowinLogo height={30} />
        </Link>
        <button
          type="button"
          onClick={onMobileClose}
          aria-label={t("closeMenu")}
          className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={rail ? t("expand") : t("collapse")}
          className="hidden rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white lg:inline-flex"
        >
          {rail ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {items.map((item) => {
          const active =
            item.href === "/campaigns"
              ? pathname === "/campaigns" || pathname.startsWith("/campaigns/")
              : pathname === item.href;
          const Icon = item.icon;
          const label = t(item.key);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 font-display text-sm font-medium transition-colors",
                rail && "lg:justify-center lg:gap-0 lg:px-0",
                active
                  ? "bg-barney/25 text-white"
                  : "text-white/65 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-barney")} />
              <span className={cn(rail && "lg:sr-only")}>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-2 pb-4">
        {user ? (
          <div className="relative" ref={userMenuRef}>
            {open ? (
              <div className="mb-1 space-y-1">
                <button
                  type="button"
                  title={t("viewProfiles")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-display text-sm font-medium text-white/65 hover:bg-white/5 hover:text-white",
                    rail && "lg:justify-center lg:gap-0 lg:px-0",
                  )}
                  onClick={() => {
                    close();
                    selectBrand(null);
                    onMobileClose?.();
                    router.push("/brands");
                  }}
                >
                  <ArrowLeftRight className="h-4 w-4 shrink-0" />
                  <span className={cn(rail && "lg:sr-only")}>{t("viewProfiles")}</span>
                </button>
                <button
                  type="button"
                  title={role("signOut")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-display text-sm font-medium text-white/65 hover:bg-white/5 hover:text-white",
                    rail && "lg:justify-center lg:gap-0 lg:px-0",
                  )}
                  onClick={async () => {
                    close();
                    await signOut();
                    router.replace("/login");
                  }}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className={cn(rail && "lg:sr-only")}>{role("signOut")}</span>
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={toggleUserMenu}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5",
                open && "bg-white/5",
                rail && "lg:justify-center lg:gap-0 lg:px-2",
              )}
              title={user.displayName}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-barney text-sm font-semibold">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
              <span className={cn("min-w-0 flex-1", rail && "lg:hidden")}>
                <span className="block truncate text-sm font-semibold">
                  {user.displayName}
                </span>
                <span className="block text-xs text-white/50">{role("role")}</span>
              </span>
              <ChevronUp
                className={cn(
                  "h-4 w-4 shrink-0 text-white/50 transition-transform",
                  !open && "rotate-180",
                  rail && "lg:hidden",
                )}
              />
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
