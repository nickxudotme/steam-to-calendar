import { calendarConfigFromRecord } from '@/lib/calendar-config';
import { SteamWishlistError } from '@/lib/steam/client';
import { fetchSteamDealEvents } from '@/lib/steam/deals';
import { fetchSteamMajorEvents } from '@/lib/steam/events';
import { normalizeCc, steamLocaleFromRequest } from '@/lib/steam/locale';
import { fetchWishlistCalendarData } from '@/lib/steam/pipeline';
import { fetchWatchedGameEvents } from '@/lib/steam/watched-games';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const config = calendarConfigFromRecord(body);
    const requestLocale = steamLocaleFromRequest(request);
    const locale = {
      ...requestLocale,
      cc: normalizeCc(String(body.cc ?? '')) || requestLocale.cc,
    };
    const data = await fetchWishlistCalendarData(String(body.steamId64 ?? ''), { appLimit: 100 });
    const { steamId64 } = data;
    const shouldUseWishlist = config.includeWishlist;
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
      shouldUseWishlist
        ? fetchWatchedGameEvents(data.wishlistGames.map((game) => game.appId), locale)
        : config.watchedAppIds.length
          ? fetchWatchedGameEvents(config.watchedAppIds, locale)
          : Promise.resolve([]),
    ]);
    const feedPath = `/feed/${steamId64}.ics`;
    const calendarPath = `/cal/${steamId64}`;

    return Response.json({
      steamId64,
      feedPath,
      calendarPath,
      wishlistUrl: data.wishlistUrl,
      locale,
      stats: {
        wishlistGames: data.wishlistGames.length,
        appDetails: data.appDetails.length,
        skippedAppIds: data.skippedAppIds.length,
        wishlistReleaseEvents: shouldUseWishlist ? watchedGameEvents.length : 0,
        steamMajorEvents: steamEvents.length,
      },
      events: [...dealEvents, ...watchedGameEvents, ...steamEvents].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    });
  } catch (error) {
    const status = error instanceof SteamWishlistError && error.code === 'invalid_steam_id' ? 400 : 502;
    const code = error instanceof SteamWishlistError ? error.code : 'unknown_error';
    const message = error instanceof SteamWishlistError
      ? error.message
      : 'Could not preview this Steam wishlist.';

    return Response.json({ code, message }, { status });
  }
}
