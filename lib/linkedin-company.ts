export function asCompanyName(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim()) return record.text.trim();
  if (typeof record.name === "string" && record.name.trim()) return record.name.trim();
  return "";
}

export function companyFromHeadline(headline?: string) {
  const text = headline?.trim() ?? "";
  if (!text) return "";
  const patterns = [
    /^(.+?)\s+şirketinde\b/i,
    /^(.+?)\s+kuruluşunda\b/i,
    /\bat\s+([^·|•,\n]+)/i,
    /@\s*([^·|•,\n]+)/,
    /\|\s*([^·|•\n]+)$/,
    /\s+[-–—]\s+([^·|•\n]+)$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim().replace(/\s+/g, " ");
    if (value && value.length >= 2) return value;
  }
  return "";
}

function jobCompany(job: Record<string, unknown>) {
  return (
    asCompanyName(job.company) ||
    asCompanyName(job.organization) ||
    asCompanyName(job.company_name)
  );
}

function jobEnded(job: Record<string, unknown>) {
  const ended = job.end ?? job.ended_on ?? job.end_date;
  return !(ended == null || ended === "");
}

export function companyFromProfileRecord(profile: Record<string, unknown>) {
  const jobs = [
    ...(Array.isArray(profile.current_positions) ? profile.current_positions : []),
    ...(Array.isArray(profile.work_experience) ? profile.work_experience : []),
    ...(Array.isArray(profile.experience) ? profile.experience : []),
  ].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");

  for (const job of jobs) {
    const name = jobCompany(job);
    if (name && !jobEnded(job)) return name;
  }
  for (const job of jobs) {
    const name = jobCompany(job);
    if (name) return name;
  }
  const fromField = asCompanyName(profile.company);
  if (fromField) return fromField;
  return companyFromHeadline(
    (typeof profile.headline === "string" && profile.headline) ||
      (typeof profile.description === "string" && profile.description) ||
      (typeof profile.position === "string" && profile.position) ||
      "",
  );
}

export function displayLeadCompany(lead: { company?: string; position?: string }) {
  return lead.company?.trim() || companyFromHeadline(lead.position) || "";
}
