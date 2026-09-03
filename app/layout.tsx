import type { Metadata } from "next";
import { Nunito, Poppins } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AppProviders } from "@/components/providers/AppProviders";
import { adminSessionUser } from "@/lib/admin-session";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Flowin",
  description:
    "Monitor and manage LinkedIn outreach operations for every brand from one place.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await adminSessionUser();
  return (
    <html lang="tr" className={`${poppins.variable} ${nunito.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden font-sans">
        <AppProviders initialUser={user}>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
