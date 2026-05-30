import {
  buildCalendarHeadResponse,
  buildCalendarResponse,
  calendarErrorResponse,
  logCalendarRequest,
} from "@/server/calendar/response";
import { SteamWishlistError } from "@/integrations/steam/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseFeedPath(feedPath: string[]): string {
  if (feedPath.length !== 1 || !feedPath[0].endsWith(".ics")) {
    throw new SteamWishlistError(
      "invalid_steam_id",
      "Feed URL must look like /feed/{steamId64}.ics.",
    );
  }

  return feedPath[0].slice(0, -".ics".length);
}

type RouteContext = {
  params: Promise<{ feedPath?: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { feedPath = [] } = await context.params;
    const steamId64 = parseFeedPath(feedPath);
    const response = await buildCalendarResponse(steamId64, request);
    logCalendarRequest(request, response, {
      durationMs: Date.now() - startedAt,
      route: "/feed/[...feedPath]",
      steamId64,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof SteamWishlistError
        ? `${error.code}: ${error.message}`
        : "unknown_error: Could not generate Steam wishlist calendar.";

    const response = calendarErrorResponse(error, message);
    logCalendarRequest(request, response, {
      durationMs: Date.now() - startedAt,
      route: "/feed/[...feedPath]",
    });
    return response;
  }
}

export async function HEAD(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { feedPath = [] } = await context.params;
    const steamId64 = parseFeedPath(feedPath);
    const response = buildCalendarHeadResponse(steamId64);
    logCalendarRequest(request, response, {
      durationMs: Date.now() - startedAt,
      route: "/feed/[...feedPath]",
      steamId64,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof SteamWishlistError
        ? `${error.code}: ${error.message}`
        : "unknown_error: Could not generate Steam wishlist calendar.";

    const response = calendarErrorResponse(error, message);
    logCalendarRequest(request, response, {
      durationMs: Date.now() - startedAt,
      route: "/feed/[...feedPath]",
    });
    return response;
  }
}
