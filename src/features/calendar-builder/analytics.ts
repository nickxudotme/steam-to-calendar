"use client";

import { track } from "@vercel/analytics";

type AnalyticsPropertyValue = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: AnalyticsProperties) => void;
    };
  }
}

export function trackAnalyticsEvent(eventName: string, properties?: AnalyticsProperties) {
  track(eventName, properties);
  window.umami?.track(eventName, properties);
}
