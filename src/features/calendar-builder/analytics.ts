"use client";

type AnalyticsPropertyValue = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

const ANALYTICS_TRACK_RETRY_DELAY_MS = 250;
const ANALYTICS_TRACK_RETRY_LIMIT = 20;

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: AnalyticsProperties) => void;
    };
  }
}

export function trackAnalyticsEvent(
  eventName: string,
  properties?: AnalyticsProperties,
  attempt = 0,
) {
  if (window.umami) {
    window.umami.track(eventName, properties);
    return;
  }

  if (attempt >= ANALYTICS_TRACK_RETRY_LIMIT) {
    return;
  }

  window.setTimeout(
    () => trackAnalyticsEvent(eventName, properties, attempt + 1),
    ANALYTICS_TRACK_RETRY_DELAY_MS,
  );
}

export function analyticsRawInput(properties: AnalyticsProperties): AnalyticsProperties {
  return process.env.NEXT_PUBLIC_ANALYTICS_CAPTURE_RAW_INPUTS === "1" ? properties : {};
}
