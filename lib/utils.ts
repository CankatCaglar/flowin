import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function successRate(sent: number, replied: number) {
  if (sent <= 0) return 0;
  return (replied / sent) * 100;
}

export function trendPercent(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function displayNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || email;
}
