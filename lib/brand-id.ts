const TR: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

export function brandSlug(name: string) {
  const mapped = name.replace(/[çğıöşüÇĞİÖŞÜâîû]/g, (char) => TR[char] ?? char);
  return (
    mapped
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "brand"
  );
}

export function looksLikeAutoId(id: string) {
  return /^[A-Za-z0-9]{20}$/.test(id);
}
