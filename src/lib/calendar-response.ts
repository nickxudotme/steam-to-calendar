import { mapWishlistReleaseEvents } from '@/lib/events/mapper';
import { STEAM_EVENTS_CALENDAR_ID } from '@/lib/calendar-constants';
import { calendarContentType, generateCalendar } from '@/lib/ics/generator';
import { SteamWishlistError } from '@/lib/steam/client';
import { fetchSteamDealEvents } from '@/lib/steam/deals';
import { fetchSteamMajorEvents } from '@/lib/steam/events';
import { steamLocaleFromRequest, type SteamLocaleOptions } from '@/lib/steam/locale';
import { fetchWishlistCalendarData } from '@/lib/steam/pipeline';

export async function buildCalendarResponse(steamInput: string, request?: Request): Promise<Response> {
  try {
    const locale = request ? steamLocaleFromRequest(request) : defaultSteamLocale();

    if (steamInput === STEAM_EVENTS_CALENDAR_ID) {
      const [dealEvents, steamEvents] = await Promise.all([
        fetchSteamDealEvents({ ...locale, count: 5 }),
        fetchSteamMajorEvents(locale),
      ]);
      const events = [...dealEvents, ...steamEvents];
      const calendar = generateCalendar(events);

      return new Response(calendar, {
        status: 200,
        headers: calendarHeaders(steamInput),
      });
    }

    const data = await fetchWishlistCalendarData(steamInput);
    const [dealEvents, steamEvents] = await Promise.all([
      fetchSteamDealEvents({ ...locale, count: 5 }),
      fetchSteamMajorEvents(locale),
    ]);
    const events = [
      ...dealEvents,
      ...mapWishlistReleaseEvents(data.appDetails),
      ...steamEvents,
    ];
    const calendar = generateCalendar(events);

    return new Response(calendar, {
      status: 200,
      headers: calendarHeaders(data.steamId64),
    });
  } catch (error) {
    const message = error instanceof SteamWishlistError
      ? `${error.code}: ${error.message}`
      : 'unknown_error: Could not generate Steam wishlist calendar.';

    return new Response(message, {
      status: error instanceof SteamWishlistError && error.code === 'invalid_steam_id' ? 400 : 502,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
}

function defaultSteamLocale(): SteamLocaleOptions {
  return {
    cc: 'US',
    lang: 'english',
    uiLang: 'en',
  };
}

export function calendarHeaders(steamId64: string): HeadersInit {
  const filename = steamId64 === STEAM_EVENTS_CALENDAR_ID
    ? 'steam-sale-calendar.ics'
    : `steam-wishlist-${steamId64}.ics`;

  return {
    'content-type': calendarContentType(),
    'content-disposition': `attachment; filename=${filename}`,
    'cache-control': 'public, max-age=1800, s-maxage=1800',
  };
}

export function logCalendarRequest(
  request: Request,
  response: Response,
  details: { route: string; steamId64?: string },
) {
  const contentLength = response.headers.get('content-length') ?? 'chunked';
  const contentType = response.headers.get('content-type') ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const accept = request.headers.get('accept') ?? 'unknown';

  console.log(
    [
      '[calendar-request]',
      new Date().toISOString(),
      `route=${details.route}`,
      `method=${request.method}`,
      `status=${response.status}`,
      `steamId64=${details.steamId64 ?? 'unknown'}`,
      `url=${request.url}`,
      `contentType=${contentType}`,
      `contentLength=${contentLength}`,
      `accept=${JSON.stringify(accept)}`,
      `userAgent=${JSON.stringify(userAgent)}`,
    ].join(' '),
  );
}
