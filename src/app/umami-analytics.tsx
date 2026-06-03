import Script from "next/script";

const DEFAULT_UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";

export function UmamiAnalytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();

  if (!websiteId) {
    return null;
  }

  return (
    <Script
      async
      data-website-id={websiteId}
      src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() || DEFAULT_UMAMI_SCRIPT_URL}
      strategy="afterInteractive"
    />
  );
}
