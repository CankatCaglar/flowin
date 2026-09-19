export function isInsufficientCreditsReason(reason: string) {
  const text = reason.toLowerCase();
  return (
    text.includes("insufficient credit") ||
    text.includes("not enough credit") ||
    text.includes("out of credit") ||
    text.includes("no credit") ||
    text.includes("inmail kredisi")
  );
}

export function humanizeFailReason(reason: string, locale = "tr") {
  const text = reason.trim();
  if (!text) return "";
  if (isInsufficientCreditsReason(text)) {
    return locale.startsWith("tr")
      ? "InMail kredisi yetersiz. Karşı tarafın Premium olmaması değil; gönderen LinkedIn hesabının InMail kredisi bitmiş."
      : "Not enough InMail credits. This is the sending account, not the recipient’s Premium status.";
  }
  return text;
}
