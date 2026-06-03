"use client";

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
  window.umami?.track(eventName, properties);
}

export function analyticsRawInput(properties: AnalyticsProperties): AnalyticsProperties {
  return process.env.NEXT_PUBLIC_ANALYTICS_CAPTURE_RAW_INPUTS === "1" ? properties : {};
}
