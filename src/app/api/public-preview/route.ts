import { STEAM_EVENTS_CALENDAR_ID } from '@/lib/calendar-constants';
import { SteamWishlistError } from '@/lib/steam/client';
import { fetchSteamMajorEvents } from '@/lib/steam/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const steamEvents = await fetchSteamMajorEvents();

    return Response.json({
      steamId64: STEAM_EVENTS_CALENDAR_ID,
      feedPath: `/feed/${STEAM_EVENTS_CALENDAR_ID}.ics`,
      calendarPath: `/cal/${STEAM_EVENTS_CALENDAR_ID}`,
      wishlistUrl: '',
      stats: {
        wishlistGames: 0,
        appDetails: 0,
        skippedAppIds: 0,
        wishlistReleaseEvents: 0,
        steamMajorEvents: steamEvents.length,
      },
      events: steamEvents.sort((a, b) => a.startDate.localeCompare(b.startDate)),
    });
  } catch (error) {
    const code = error instanceof SteamWishlistError ? error.code : 'unknown_error';
    const message = error instanceof SteamWishlistError
      ? error.message
      : 'Could not load Steam events.';

    return Response.json({ code, message }, { status: 502 });
  }
}
