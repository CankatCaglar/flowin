export type ImportedLead = {
  fullName: string;
  linkedinUrl: string;
  company: string;
  position: string;
  email: string;
  phone: string;
};

export type LeadImportResult = {
  leads: ImportedLead[];
  skipped: number;
  fileName: string;
};

const NAME_KEYS = ["fullname", "full_name", "name", "adsoyad", "ad soyad", "isim"];
const FIRST_KEYS = ["firstname", "first_name", "givenname", "ad", "first"];
const LAST_KEYS = ["lastname", "last_name", "familyname", "soyad", "last"];
const LINKEDIN_KEYS = [
  "linkedin",
  "linkedinurl",
  "linkedin_url",
  "linkedin profile url",
  "profileurl",
  "profile url",
  "profile",
  "url",
  "profil",
];
const COMPANY_KEYS = ["company", "sirket", "firma", "organization", "organisation"];
const POSITION_KEYS = ["position", "title", "jobtitle", "unvan", "pozisyon", "rol"];
const EMAIL_KEYS = ["email", "e-mail", "eposta", "e-posta"];
const PHONE_KEYS = ["phone", "telefon", "mobile", "cep"];

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cell(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value) return value;
  }
  return "";
}

function normalizeLinkedInUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.replace(/^www\./, "").includes("linkedin.com")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function mapRow(raw: Record<string, string>): ImportedLead | null {
  const row: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    row[normalizeHeader(key)] = String(value ?? "").trim();
  }
  const first = cell(row, FIRST_KEYS);
  const last = cell(row, LAST_KEYS);
  const fullName = cell(row, NAME_KEYS) || [first, last].filter(Boolean).join(" ").trim();
  const linkedinUrl = normalizeLinkedInUrl(cell(row, LINKEDIN_KEYS));
  if (!fullName || !linkedinUrl) return null;
  return {
    fullName,
    linkedinUrl,
    company: cell(row, COMPANY_KEYS),
    position: cell(row, POSITION_KEYS),
    email: cell(row, EMAIL_KEYS),
    phone: cell(row, PHONE_KEYS),
  };
}

function parseCsv(text: string): Record<string, string>[] {
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
    if (char === "," && !inQuotes) {
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
  const headers = (rows[0] ?? []).map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });
    return item;
  });
}

export async function parseLeadFile(file: File): Promise<LeadImportResult> {
  const name = file.name.toLowerCase();
  let records: Record<string, string>[] = [];
  if (name.endsWith(".csv") || file.type === "text/csv") {
    records = parseCsv(await file.text());
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    records = sheet
      ? XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false })
      : [];
  } else {
    throw new Error("unsupported-file");
  }

  const seen = new Set<string>();
  const leads: ImportedLead[] = [];
  let skipped = 0;
  for (const record of records) {
    const lead = mapRow(record);
    if (!lead) {
      skipped += 1;
      continue;
    }
    const key = lead.linkedinUrl.toLocaleLowerCase();
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    leads.push(lead);
  }
  return { leads, skipped, fileName: file.name };
}
