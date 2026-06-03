import { createHash } from "node:crypto";

type LogLevel = "info" | "error";

export function hashLogValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function logStructuredEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown>,
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

  logStructuredEvent(level, event, {
    durationMs: Date.now() - startedAt,
    method: request.method,
    path: url.pathname,
    queryKeys: [...url.searchParams.keys()].sort(),
    requestId: requestId(request),
    route,
    status,
    ...fields,
  });
}
