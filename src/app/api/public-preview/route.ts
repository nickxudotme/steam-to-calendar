import { STEAM_EVENTS_CALENDAR_ID } from '@/lib/calendar-constants';
import { calendarConfigFromRequest } from '@/lib/calendar-config';
import { SteamWishlistError } from '@/lib/steam/client';
import { fetchSteamDealEvents } from '@/lib/steam/deals';
import { fetchSteamMajorEvents } from '@/lib/steam/events';
import { steamLocaleFromRequest } from '@/lib/steam/locale';
import { fetchWatchedGameEvents } from '@/lib/steam/watched-games';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const locale = steamLocaleFromRequest(request);
    const config = calendarConfigFromRequest(request);
    const [dealEvents, steamEvents, watchedGameEvents] = await Promise.all([
      config.includeDeals ? fetchSteamDealEvents({ ...locale, count: config.dealCount }) : Promise.resolve([]),
      config.includeSteamEvents
        ? fetchSteamMajorEvents({
          ...locale,
          categories: config.steamEventCategories,
          futureDays: config.eventFutureDays,
          pastDays: config.eventPastDays,
        })
        : Promise.resolve([]),
      config.watchedAppIds.length ? fetchWatchedGameEvents(config.watchedAppIds, locale) : Promise.resolve([]),
    ]);
    const events = [...dealEvents, ...watchedGameEvents, ...steamEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));

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
        wishlistReleaseEvents: watchedGameEvents.length,
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
