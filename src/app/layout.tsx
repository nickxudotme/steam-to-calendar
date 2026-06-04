import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { headers } from "next/headers";
import Script from "next/script";
import type { ReactNode } from "react";
import { languageCodeFromAcceptLanguage } from "@/features/calendar-builder/browser-locale";
import "@/features/calendar-builder/styles.css";
import { UmamiAnalytics } from "./umami-analytics";

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

const workbenchLayoutScript = `
(() => {
  try {
    const storedValue = window.localStorage.getItem("steam-to-calendar-workbench-layout");
    if (!storedValue) {
      return;
    }

    const parsedValue = JSON.parse(storedValue);
    if (typeof parsedValue.config !== "number" || typeof parsedValue.detail !== "number") {
      return;
    }

    const clamp = (value, min, max) => Math.round(Math.min(Math.max(value, min), max));
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
    const availableSideWidth = viewportWidth ? viewportWidth - 420 - 40 : Infinity;
    let config = clamp(parsedValue.config, 240, 460);
    let detail = clamp(parsedValue.detail, 260, 480);

    if (availableSideWidth <= 500) {
      config = 240;
      detail = 260;
    } else if (config + detail > availableSideWidth) {
      let excess = config + detail - availableSideWidth;
      const detailShrink = Math.min(excess, detail - 260);
      detail -= detailShrink;
      excess -= detailShrink;
      if (excess > 0) {
        config -= Math.min(excess, config - 240);
      }
    }

    const style = document.createElement("style");
    style.dataset.workbenchLayout = "true";
    style.textContent =
      ".calendarWorkbench{--config-panel-width:" +
      config +
      "px;--detail-panel-width:" +
      detail +
      "px}";
    document.head.appendChild(style);
  } catch {
  }
})();
`;

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  const initialLanguage = languageCodeFromAcceptLanguage(requestHeaders.get("accept-language"));
  const hostname = requestHeaders.get("host")?.split(":")[0]?.toLowerCase() ?? null;

  return (
    <html lang={initialLanguage.uiLang}>
      <body>
        <Script
          id="workbench-layout-vars"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: workbenchLayoutScript }}
        />
        {children}
        <UmamiAnalytics hostname={hostname} />
        <SpeedInsights />
      </body>
    </html>
  );
}
