import {
  buildCalendarHeadResponse,
  buildCalendarResponse,
  logCalendarRequest,
} from "@/server/calendar/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ steamId64: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();
  const { steamId64 } = await context.params;
  const response = await buildCalendarResponse(steamId64, request);
  logCalendarRequest(request, response, {
    durationMs: Date.now() - startedAt,
    route: "/cal/[steamId64]",
    steamId64,
  });
  return response;
}

export async function HEAD(request: Request, context: RouteContext) {
  const startedAt = Date.now();
  const { steamId64 } = await context.params;
  const response = buildCalendarHeadResponse(steamId64);
  logCalendarRequest(request, response, {
    durationMs: Date.now() - startedAt,
    route: "/cal/[steamId64]",
    steamId64,
  });
  return response;
}
