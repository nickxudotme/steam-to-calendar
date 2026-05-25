import { buildCalendarResponse, logCalendarRequest } from '@/lib/calendar-response';
import { SteamWishlistError } from '@/lib/steam/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseFeedPath(feedPath: string[]): string {
  if (feedPath.length !== 1 || !feedPath[0].endsWith('.ics')) {
    throw new SteamWishlistError('invalid_steam_id', 'Feed URL must look like /feed/{steamId64}.ics.');
  }

  return feedPath[0].slice(0, -'.ics'.length);
}

type RouteContext = {
  params: Promise<{ feedPath?: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { feedPath = [] } = await context.params;
    const steamId64 = parseFeedPath(feedPath);
    const response = await buildCalendarResponse(steamId64, request);
    logCalendarRequest(request, response, { route: '/feed/[...feedPath]', steamId64 });
    return response;
  } catch (error) {
    const message = error instanceof SteamWishlistError
      ? `${error.code}: ${error.message}`
      : 'unknown_error: Could not generate Steam wishlist calendar.';

    const response = new Response(message, {
      status: error instanceof SteamWishlistError && error.code === 'invalid_steam_id' ? 400 : 502,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
    logCalendarRequest(request, response, { route: '/feed/[...feedPath]' });
    return response;
  }
}
