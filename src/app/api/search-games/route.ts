import { SteamWishlistError } from '@/lib/steam/client';
import { normalizeCc, steamLocaleFromRequest } from '@/lib/steam/locale';
import { searchSteamGames } from '@/lib/steam/search';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locale = steamLocaleFromRequest(request);
    const cc = normalizeCc(url.searchParams.get('cc')) ?? locale.cc;
    const query = url.searchParams.get('query') ?? '';
    const results = await searchSteamGames(query, { ...locale, cc, count: 8 });

    return Response.json({ results });
  } catch (error) {
    const code = error instanceof SteamWishlistError ? error.code : 'unknown_error';
    const message = error instanceof SteamWishlistError
      ? error.message
      : 'Could not search Steam games.';

    return Response.json({ code, message }, { status: 502 });
  }
}
