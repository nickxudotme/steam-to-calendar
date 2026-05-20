import { mapSteamMajorEvents, mapWishlistReleaseEvents } from '@/lib/events/mapper';
import { SteamWishlistError, normalizeSteamId64 } from '@/lib/steam/client';
import { fetchWishlistCalendarData } from '@/lib/steam/pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const steamId64 = normalizeSteamId64(String(body.steamId64 ?? ''));
    const data = await fetchWishlistCalendarData(steamId64, { appLimit: 100 });
    const wishlistEvents = mapWishlistReleaseEvents(data.appDetails);
    const steamEvents = mapSteamMajorEvents();
    const feedPath = `/feed/${steamId64}.ics`;
    const calendarPath = `/cal/${steamId64}`;

    return Response.json({
      steamId64,
      feedPath,
      calendarPath,
      wishlistUrl: data.wishlistUrl,
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
