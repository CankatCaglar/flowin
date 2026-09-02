export function normalizeLinkedInUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.replace(/^www\./, "").includes("linkedin.com")) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function linkedInProfileHref(publicId: string) {
  const value = publicId.trim().replace(/^\/+|\/+$/g, "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return normalizeLinkedInUrl(value);
  if (value.includes("linkedin.com/")) {
    return normalizeLinkedInUrl(value.startsWith("http") ? value : `https://${value}`);
  }
  return `https://www.linkedin.com/in/${encodeURIComponent(value)}`;
}

export function linkedInPublicId(url: string) {
  const normalized = normalizeLinkedInUrl(url);
  if (!normalized) return "";
  try {
    const path = new URL(normalized).pathname;
    const classic = path.match(/\/in\/([^/]+)/i);
    if (classic?.[1]) return decodeURIComponent(classic[1]).replace(/\/+$/, "");
    const sales = path.match(/\/sales\/lead\/([^/,]+)/i);
    if (sales?.[1]) return decodeURIComponent(sales[1]).replace(/\/+$/, "");
    return "";
  } catch {
    return "";
  }
}

export function splitPersonName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function interpolateTemplate(
  template: string,
  values: Record<string, string>,
) {
  const aliases: Record<string, string> = {
    firstName: values.firstName ?? "",
    lastName: values.lastName ?? "",
    first_name: values.firstName ?? "",
    last_name: values.lastName ?? "",
    company: values.company ?? "",
    position: values.position ?? "",
  };
  const lookup = (key: string) => aliases[key] ?? values[key] ?? "";
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => lookup(key))
    .replace(/\{(\w+)\}/g, (_, key: string) => lookup(key));
}
