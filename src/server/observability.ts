import { createHash } from "node:crypto";

type LogLevel = "info" | "error";
type UmamiDataValue = string | number | boolean | null | undefined;

const DEFAULT_UMAMI_COLLECT_URL = "https://umami.nickxu.me/api/send";
const SERVER_ANALYTICS_IGNORED_EVENTS = new Set(["health_checked"]);

export function hashLogValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function logStructuredEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown>,
  options: { request?: Request } = {},
) {
  const payload = {
    event,
    level,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
  } else {
    console.log(serialized);
  }

  trackServerAnalyticsEvent(event, payload, options.request);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function rawInput(fields: Record<string, unknown>): Record<string, unknown> {
  return process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS === "1" ? { rawInput: fields } : {};
}

export function requestId(request: Request): string | null {
  return request.headers.get("x-vercel-id") ?? request.headers.get("x-request-id");
}

export function logApiRequest({
  event,
  fields = {},
  level,
  request,
  route,
  startedAt,
  status,
}: {
  event: string;
  fields?: Record<string, unknown>;
  level: LogLevel;
  request: Request;
  route: string;
  startedAt: number;
  status: number;
}) {
  const url = new URL(request.url);

  logStructuredEvent(
    level,
    event,
    {
      durationMs: Date.now() - startedAt,
      method: request.method,
      path: url.pathname,
      queryKeys: [...url.searchParams.keys()].sort(),
      requestId: requestId(request),
      route,
      status,
      ...fields,
    },
    { request },
  );
}

function trackServerAnalyticsEvent(
  event: string,
  fields: Record<string, unknown>,
  request?: Request,
) {
  const websiteId =
    process.env.UMAMI_WEBSITE_ID?.trim() || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();

  if (!websiteId || SERVER_ANALYTICS_IGNORED_EVENTS.has(event)) {
    return;
  }

  const collectUrl = process.env.UMAMI_COLLECT_URL?.trim() || DEFAULT_UMAMI_COLLECT_URL;
  const requestUrl = request ? new URL(request.url) : null;
  const hostname =
    requestUrl?.hostname ||
    process.env.UMAMI_HOSTNAME?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "steamcalendar.com";
  const url = requestUrl
    ? `${requestUrl.pathname}${shouldCaptureRawServerInputs() ? requestUrl.search : ""}`
    : typeof fields.route === "string"
      ? fields.route
      : "/";
  const userAgent = request?.headers.get("user-agent") ?? undefined;

  const body = {
    payload: {
      data: sanitizeUmamiData(fields),
      hostname,
      language: request?.headers.get("accept-language") ?? undefined,
      name: event,
      referrer: request?.headers.get("referer") ?? undefined,
      screen: "server",
      title: "Server event",
      url,
      website: websiteId,
      ...(userAgent ? { userAgent } : {}),
    },
    type: "event",
  };

  void fetch(collectUrl, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "umami_server_event_failed",
        error: errorMessage(error),
        originalEvent: event,
        timestamp: new Date().toISOString(),
      }),
    );
  });
}

function shouldCaptureRawServerInputs(): boolean {
  return process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS === "1";
}

function sanitizeUmamiData(fields: Record<string, unknown>): Record<string, UmamiDataValue> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, sanitizeUmamiValue(value)]),
  );
}

function sanitizeUmamiValue(value: unknown): UmamiDataValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(",");
  }

  return JSON.stringify(value);
}
