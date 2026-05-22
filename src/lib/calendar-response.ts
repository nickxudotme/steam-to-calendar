import { mapWishlistReleaseEvents } from '@/lib/events/mapper';
import { calendarContentType, generateCalendar } from '@/lib/ics/generator';
import { SteamWishlistError } from '@/lib/steam/client';
import { fetchSteamMajorEvents } from '@/lib/steam/events';
import { fetchWishlistCalendarData } from '@/lib/steam/pipeline';

export const STEAM_EVENTS_CALENDAR_ID = 'steam-events';

export async function buildCalendarResponse(steamId64: string): Promise<Response> {
  try {
    if (steamId64 === STEAM_EVENTS_CALENDAR_ID) {
      const events = await fetchSteamMajorEvents();
      const calendar = generateCalendar(events);

      return new Response(calendar, {
        status: 200,
        headers: calendarHeaders(steamId64),
      });
    }

    const data = await fetchWishlistCalendarData(steamId64);
    const steamEvents = await fetchSteamMajorEvents();
    const events = [
      ...mapWishlistReleaseEvents(data.appDetails),
      ...steamEvents,
    ];
    const calendar = generateCalendar(events);

    return new Response(calendar, {
      status: 200,
      headers: calendarHeaders(steamId64),
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

export function calendarHeaders(steamId64: string): HeadersInit {
  const filename = steamId64 === STEAM_EVENTS_CALENDAR_ID
    ? 'steam-events.ics'
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
