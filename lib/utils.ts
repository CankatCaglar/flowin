import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { daysBetween } from "@/lib/dates";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function brandInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US").format(value);
}

export function formatPercent(value: number, locale: string, digits = 1) {
  return `${new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;
}

export function formatDecimal(value: number, locale: string, digits = 1) {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function formatDateTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function formatLastAction(value: Date, now: Date, locale: string) {
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  const time = new Intl.DateTimeFormat(tag, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
  const diff = daysBetween(value, now);
  if (diff === 0) return locale === "tr" ? `Bugün ${time}` : `Today ${time}`;
  if (diff === 1) return locale === "tr" ? `Dün ${time}` : `Yesterday ${time}`;
  const datePart = new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    ...(value.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(value);
  return `${datePart} ${time}`;
}

export function personInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function successRate(sent: number, replied: number) {
  if (sent <= 0) return 0;
  return (replied / sent) * 100;
}

export function trendPercent(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function formatDurationShort(days: number, locale: string) {
  const totalMinutes = Math.max(0, Math.round(days * 24 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (locale === "tr") {
    if (hours <= 0) return `${minutes}dk`;
    return minutes > 0 ? `${hours}s ${minutes}dk` : `${hours}s`;
  }
  if (hours <= 0) return `${minutes}m`;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function displayNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || email;
}
