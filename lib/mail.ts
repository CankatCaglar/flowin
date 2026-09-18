import "server-only";
import { Resend } from "resend";
import { appOrigin } from "@/lib/unipile";

const DEFAULT_FROM = "Flowin by Nera <flowin@nerainnovations.com>";

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

export function notificationRecipient(brandEmail?: string | null) {
  return brandEmail?.trim().toLowerCase() ?? "";
}

export function notificationAppUrl(path: string) {
  const origin = appOrigin().replace(/\/+$/, "");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${origin}/tr${clean}`;
}

function lumaBody(body: string, url: string) {
  return `Merhaba,\n\n${body}\n\n${url}\n\nİyi çalışmalar,\nFlowin by Nera`;
}

function lumaHtml(body: string, url: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const href = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<p>Merhaba,</p>
<p>${escaped.replace(/\n/g, "<br/>")}</p>
<p><a href="${href}">${href}</a></p>
<p>İyi çalışmalar,<br/>Flowin by Nera</p>`;
}

export async function sendNotificationEmail(input: {
  to: string;
  subject: string;
  body: string;
  url: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const to = notificationRecipient(input.to);
  if (!apiKey) {
    console.error("[mail] RESEND_API_KEY missing");
    return { ok: false as const, error: "unconfigured" };
  }
  if (!to) {
    console.error("[mail] brand recipient email missing");
    return { ok: false as const, error: "no-recipient" };
  }
  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress(),
      to,
      subject: input.subject,
      text: lumaBody(input.body, input.url),
      html: lumaHtml(input.body, input.url),
    });
    if (result.error) {
      console.error("[mail] resend failed:", result.error.message);
      return { ok: false as const, error: result.error.message };
    }
    return { ok: true as const };
  } catch (error) {
    console.error("[mail] send failed:", error instanceof Error ? error.message : error);
    return { ok: false as const, error: "send-failed" };
  }
}
