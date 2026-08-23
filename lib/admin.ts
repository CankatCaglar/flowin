import { timingSafeEqual } from "crypto";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getAdminCredentials() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  return { email, password };
}

export function verifyAdminLogin(email: string, password: string) {
  const admin = getAdminCredentials();
  if (!admin.email || !admin.password) return false;
  return (
    safeEqual(email.trim().toLowerCase(), admin.email) &&
    safeEqual(password, admin.password)
  );
}
