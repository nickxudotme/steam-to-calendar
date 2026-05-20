import { buildCalendarResponse, logCalendarRequest } from '@/lib/calendar-response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ steamId64: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { steamId64 } = await context.params;
  const response = await buildCalendarResponse(steamId64);
  logCalendarRequest(request, response, { route: '/cal/[steamId64]', steamId64 });
  return response;
}

export async function HEAD(request: Request, context: RouteContext) {
  const { steamId64 } = await context.params;
  const response = await buildCalendarResponse(steamId64);
  logCalendarRequest(request, response, { route: '/cal/[steamId64]', steamId64 });
  return response;
}
