import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { languageCodeFromAcceptLanguage } from "@/features/calendar-builder/browser-locale";
import "@/features/calendar-builder/styles.css";

export const metadata: Metadata = {
  title: "Steam To Calendar",
  description:
    "Track Steam deals, preorders, sales, fests, and watched games in your calendar app.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/assets/brand/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/assets/brand/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/assets/brand/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  const initialLanguage = languageCodeFromAcceptLanguage(requestHeaders.get("accept-language"));

  return (
    <html lang={initialLanguage.uiLang}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
