import { STEAM_EVENTS_CALENDAR_ID } from '@/lib/calendar-constants';
import { SteamWishlistError } from '@/lib/steam/client';
import { fetchSteamDealEvents } from '@/lib/steam/deals';
import { fetchSteamMajorEvents } from '@/lib/steam/events';
import { steamLocaleFromRequest } from '@/lib/steam/locale';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const locale = steamLocaleFromRequest(request);
    const [dealEvents, steamEvents] = await Promise.all([
      fetchSteamDealEvents({ ...locale, count: 5 }),
      fetchSteamMajorEvents(locale),
    ]);
    const events = [...dealEvents, ...steamEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));

    return Response.json({
      steamId64: STEAM_EVENTS_CALENDAR_ID,
      feedPath: `/feed/${STEAM_EVENTS_CALENDAR_ID}.ics`,
      calendarPath: `/cal/${STEAM_EVENTS_CALENDAR_ID}`,
      wishlistUrl: '',
      locale,
      stats: {
        wishlistGames: 0,
        appDetails: 0,
        skippedAppIds: 0,
        wishlistReleaseEvents: dealEvents.length,
        steamMajorEvents: steamEvents.length,
      },
      events,
    });
  } catch (error) {
    const code = error instanceof SteamWishlistError ? error.code : 'unknown_error';
    const message = error instanceof SteamWishlistError
      ? error.message
      : 'Could not load Steam events.';

    return Response.json({ code, message }, { status: 502 });
  }
}
