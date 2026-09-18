import { leadIdentityKeys } from "@/lib/lead-identity";
import { normalizeLinkedInUrl } from "@/lib/linkedin-profile";

export type ImportedLead = {
  fullName: string;
  linkedinUrl: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  unipileProviderId?: string;
  pictureUrl?: string;
};

export type LeadImportResult = {
  leads: ImportedLead[];
  skipped: number;
  fileName: string;
};

const NAME_KEYS = [
  "linkedinname",
  "fullname",
  "fullnameofcontact",
  "personname",
  "contactname",
  "prospectname",
  "leadname",
  "name",
  "adsoyad",
  "isim",
];
const FIRST_KEYS = ["firstname", "givenname", "given", "ad", "first"];
const LAST_KEYS = ["lastname", "familyname", "surname", "soyad", "last"];
const LINKEDIN_KEYS = [
  "profilelink",
  "linkedinurl",
  "linkedinprofileurl",
  "linkedinprofilelink",
  "linkedinprofile",
  "personlinkedinurl",
  "publicprofileurl",
  "profileurl",
  "salesnavigatorprofilelink",
  "salesnavigatorurl",
  "salesnavurl",
  "salesnavigatorprofileurl",
  "linkedinlink",
  "linkedin",
  "memberurl",
  "vanityurl",
  "profile",
  "profil",
  "url",
];
const COMPANY_KEYS = [
  "organisation",
  "organization",
  "companyname",
  "currentcompany",
  "company",
  "account",
  "employer",
  "sirket",
  "firma",
];
const POSITION_KEYS = [
  "currentroles",
  "currentrole",
  "currenttitle",
  "jobtitle",
  "headline",
  "occupation",
  "position",
  "title",
  "description",
  "unvan",
  "pozisyon",
  "rol",
  "role",
  "job",
];
const EMAIL_KEYS = ["email", "emailaddress", "e-mail", "eposta", "e-posta", "mail"];
const PHONE_KEYS = ["phone", "phonenumber", "mobile", "mobilephone", "telefon", "cep"];

const LINKEDIN_URL_RE =
  /(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/(?:in|sales\/lead|sales\/people)\/[^\s"'<>\\]+/gi;

function compactKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[compactKey(key)];
    if (value) return value;
  }
  return "";
}

function cleanLinkedInUrl(raw: string) {
  const trimmed = raw.trim().replace(/[),.;]+$/g, "");
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.endsWith("linkedin.com")) return "";
    const inMatch = url.pathname.match(/\/in\/([^/]+)/i);
    if (inMatch?.[1]) {
      const handle = decodeURIComponent(inMatch[1]).replace(/\/+$/, "");
      if (handle) return `https://www.linkedin.com/in/${handle}`;
    }
    const salesMatch = url.pathname.match(/\/sales\/(?:lead|people)\/([^/,]+)/i);
    if (salesMatch?.[1]) {
      const id = decodeURIComponent(salesMatch[1]).replace(/\/+$/, "");
      if (id) return `https://www.linkedin.com/sales/lead/${id}`;
    }
    return normalizeLinkedInUrl(withProtocol);
  } catch {
    return "";
  }
}

function extractLinkedInUrl(value: string) {
  const matches = value.match(LINKEDIN_URL_RE) ?? [];
  const ranked = [...matches].sort((left, right) => {
    const score = (item: string) => (/\/in\//i.test(item) ? 0 : 1);
    return score(left) - score(right);
  });
  for (const match of ranked) {
    const url = cleanLinkedInUrl(match);
    if (url) return url;
  }
  return cleanLinkedInUrl(value);
}

function linkedinUrlFromRow(row: Record<string, string>, original: Record<string, string>) {
  for (const key of LINKEDIN_KEYS) {
    const value = row[compactKey(key)];
    if (!value) continue;
    const url = extractLinkedInUrl(value);
    if (url) return url;
  }
  for (const value of Object.values(original)) {
    const url = extractLinkedInUrl(String(value ?? ""));
    if (url) return url;
  }
  return "";
}

function compactRow(raw: Record<string, string>) {
  const row: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const compact = compactKey(key);
    const text = String(value ?? "").trim();
    if (!compact || !text || row[compact]) continue;
    row[compact] = text;
  }
  return row;
}

function mapRow(raw: Record<string, string>): ImportedLead | null {
  const row = compactRow(raw);
  const first = pick(row, FIRST_KEYS);
  const last = pick(row, LAST_KEYS);
  const fullName = [first, last].filter(Boolean).join(" ").trim() || pick(row, NAME_KEYS);
  const linkedinUrl = linkedinUrlFromRow(row, raw);
  if (!fullName || !linkedinUrl) return null;
  return {
    fullName,
    linkedinUrl,
    company: pick(row, COMPANY_KEYS),
    position: pick(row, POSITION_KEYS),
    email: pick(row, EMAIL_KEYS),
    phone: pick(row, PHONE_KEYS),
  };
}

function detectDelimiter(text: string) {
  let inQuotes = false;
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (inQuotes) continue;
    if (char === "\n" || char === "\r") break;
    if (char in counts) counts[char] += 1;
  }
  const ranked = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  const top = ranked[0];
  return top && top[1] > 0 ? top[0] : ",";
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cellValue) => cellValue.trim())) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  if (current || row.length) {
    row.push(current);
    if (row.some((cellValue) => cellValue.trim())) rows.push(row);
  }
  return rows;
}

const HEADER_HINTS = new Set(
  [
    ...NAME_KEYS,
    ...FIRST_KEYS,
    ...LAST_KEYS,
    ...LINKEDIN_KEYS,
    ...COMPANY_KEYS,
    ...POSITION_KEYS,
    ...EMAIL_KEYS,
    ...PHONE_KEYS,
    "id",
    "location",
    "industry",
    "linkedinname",
    "profilelink",
  ].map(compactKey),
);

function looksLikeHeader(cells: string[]) {
  const hits = cells.map(compactKey).filter((key) => HEADER_HINTS.has(key)).length;
  return hits >= 2;
}

function recordsFromRows(rows: string[][]) {
  const headerIndex = rows.findIndex(looksLikeHeader);
  const index = headerIndex >= 0 ? headerIndex : 0;
  const headers = (rows[index] ?? []).map((header) => String(header ?? "").trim());
  if (!headers.some(Boolean)) return [];
  return rows.slice(index + 1).map((values) => {
    const item: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (!header) return;
      item[header] = String(values[column] ?? "").trim();
    });
    return item;
  });
}

export function parseLeadRecords(records: Record<string, string>[]): Omit<LeadImportResult, "fileName"> {
  const seen = new Set<string>();
  const leads: ImportedLead[] = [];
  let skipped = 0;
  for (const record of records) {
    const lead = mapRow(record);
    if (!lead) {
      skipped += 1;
      continue;
    }
    const keys = leadIdentityKeys(lead);
    const key = keys[0] ?? lead.linkedinUrl.toLocaleLowerCase();
    if (keys.some((item) => seen.has(item)) || seen.has(key)) {
      skipped += 1;
      continue;
    }
    for (const item of keys) seen.add(item);
    seen.add(key);
    leads.push(lead);
  }
  return { leads, skipped };
}

export async function parseLeadFile(file: File): Promise<LeadImportResult> {
  const name = file.name.toLowerCase();
  let records: Record<string, string>[] = [];
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    records = recordsFromRows(parseDelimited(text, detectDelimiter(text)));
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    const rows = sheet
      ? XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
          header: 1,
          defval: "",
          raw: false,
        })
      : [];
    records = recordsFromRows(rows.map((row) => row.map((cell) => String(cell ?? ""))));
  } else {
    throw new Error("unsupported-file");
  }

  return { ...parseLeadRecords(records), fileName: file.name };
}
