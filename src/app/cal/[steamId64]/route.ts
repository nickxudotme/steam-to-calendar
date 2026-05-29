import { buildCalendarResponse, logCalendarRequest } from "@/server/calendar/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ steamId64: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { steamId64 } = await context.params;
  const response = await buildCalendarResponse(steamId64, request);
  logCalendarRequest(request, response, { route: "/cal/[steamId64]", steamId64 });
  return response;
}

export async function HEAD(request: Request, context: RouteContext) {
  const { steamId64 } = await context.params;
  const response = await buildCalendarResponse(steamId64, request);
  logCalendarRequest(request, response, { route: "/cal/[steamId64]", steamId64 });
  return response;
}
