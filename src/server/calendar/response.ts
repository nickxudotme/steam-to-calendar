import { calendarConfigFromRequest, DEFAULT_CALENDAR_CONFIG } from "@/domain/calendar/config";
import { STEAM_EVENTS_CALENDAR_ID } from "@/domain/calendar/constants";
import { calendarContentType, generateCalendar } from "@/domain/calendar/ics";
import { fetchSteamCalendarEventBundle } from "@/server/calendar/event-bundle";
import { SteamWishlistError } from "@/integrations/steam/client";
import { steamLocaleFromRequest, type SteamLocaleOptions } from "@/integrations/steam/locale";
import { fetchWishlistCalendarData } from "@/integrations/steam/pipeline";
import { hashLogValue } from "@/server/observability";

export async function buildCalendarResponse(
  steamInput: string,
  request?: Request,
): Promise<Response> {
  try {
    const locale = request ? steamLocaleFromRequest(request) : defaultSteamLocale();
    const config = request ? calendarConfigFromRequest(request) : DEFAULT_CALENDAR_CONFIG;

    if (steamInput === STEAM_EVENTS_CALENDAR_ID) {
      // The public calendar is a special synthetic "account" that contains Steam-wide events
      // plus optional manually watched apps from the query string.
      const bundle = await fetchSteamCalendarEventBundle({
        appIds: config.watchedAppIds,
        config,
        locale,
      });
      const calendar = generateCalendar(bundle.events);

      return new Response(calendar, {
        status: 200,
        headers: calendarHeaders(steamInput),
      });
    }

    const data = await fetchWishlistCalendarData(steamInput, locale);
    const shouldUseWishlist = config.includeWishlist;
    // Connected calendars can either follow the imported wishlist or fall back to explicit
    // watched app IDs when wishlist events are disabled.
    const bundle = await fetchSteamCalendarEventBundle({
      appIds: shouldUseWishlist
        ? data.wishlistGames.map((game) => game.appId)
        : config.watchedAppIds,
      config,
      locale,
    });
    const calendar = generateCalendar(bundle.events);

    return new Response(calendar, {
      status: 200,
      headers: calendarHeaders(data.steamId64),
    });
  } catch (error) {
    const message =
      error instanceof SteamWishlistError
        ? `${error.code}: ${error.message}`
        : "unknown_error: Could not generate Steam wishlist calendar.";

    return calendarErrorResponse(error, message);
  }
}

export function buildCalendarHeadResponse(steamInput: string): Response {
  return new Response(null, {
    status: 200,
    headers: calendarHeaders(steamInput || STEAM_EVENTS_CALENDAR_ID),
  });
}

export function calendarErrorResponse(error: unknown, message: string): Response {
  return new Response(message, {
    status: error instanceof SteamWishlistError && error.code === "invalid_steam_id" ? 400 : 502,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function defaultSteamLocale(): SteamLocaleOptions {
  return {
    cc: "US",
    lang: "english",
    uiLang: "en",
  };
}

export function calendarHeaders(steamId64: string): HeadersInit {
  const filename =
    steamId64 === STEAM_EVENTS_CALENDAR_ID
      ? "steam-to-calendar.ics"
      : "steam-to-calendar-wishlist.ics";

  return {
    "content-type": calendarContentType(),
    "content-disposition": `attachment; filename=${filename}`,
    "cache-control": "public, max-age=1800, s-maxage=1800",
  };
}

export function logCalendarRequest(
  request: Request,
  response: Response,
  details: { durationMs?: number; route: string; steamId64?: string },
) {
  const contentLength = response.headers.get("content-length") ?? "chunked";
  const contentType = response.headers.get("content-type") ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const accept = request.headers.get("accept") ?? "unknown";
  const url = new URL(request.url);

  console.log("[calendar-request]", {
    accept,
    contentLength,
    contentType,
    durationMs: details.durationMs,
    method: request.method,
    path: redactedPath(url.pathname, details.steamId64),
    queryKeys: [...url.searchParams.keys()].sort(),
    route: details.route,
    status: response.status,
    steamIdHash: details.steamId64 ? hashLogValue(details.steamId64) : "unknown",
    timestamp: new Date().toISOString(),
    userAgent,
  });
}

function redactedPath(pathname: string, steamId64: string | undefined): string {
  if (!steamId64) {
    return pathname;
  }

  return pathname.replace(steamId64, "[steam-id]");
}
