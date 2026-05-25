import { mapWishlistReleaseEvents } from '@/lib/events/mapper';
import { SteamWishlistError } from '@/lib/steam/client';
import { fetchSteamMajorEvents } from '@/lib/steam/events';
import { normalizeCc, steamLocaleFromRequest } from '@/lib/steam/locale';
import { fetchWishlistCalendarData } from '@/lib/steam/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestLocale = steamLocaleFromRequest(request);
    const locale = {
      ...requestLocale,
      cc: normalizeCc(String(body.cc ?? '')) || requestLocale.cc,
    };
    const data = await fetchWishlistCalendarData(String(body.steamId64 ?? ''), { appLimit: 100 });
    const { steamId64 } = data;
    const wishlistEvents = mapWishlistReleaseEvents(data.appDetails);
    const steamEvents = await fetchSteamMajorEvents(locale);
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
        wishlistReleaseEvents: wishlistEvents.length,
        steamMajorEvents: steamEvents.length,
      },
      events: [...wishlistEvents, ...steamEvents].sort((a, b) => a.startDate.localeCompare(b.startDate)),
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
