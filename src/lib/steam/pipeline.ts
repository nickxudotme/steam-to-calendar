import {
  fetchSteamAppDetails,
  fetchSteamWishlist,
  type SteamAppDetails,
  type SteamWishlistGame,
} from '@/lib/steam/client';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type WishlistCalendarData = {
  steamId64: string;
  wishlistUrl: string;
  wishlistGames: SteamWishlistGame[];
  appDetails: SteamAppDetails[];
  skippedAppIds: string[];
};

const DEFAULT_APP_LIMIT = 100;
const DEFAULT_CONCURRENCY = 5;

export async function fetchWishlistCalendarData(
  input: string,
  options: { fetcher?: FetchLike; appLimit?: number; concurrency?: number; timeoutMs?: number } = {},
): Promise<WishlistCalendarData> {
  const wishlist = await fetchSteamWishlist(input, options);
  const limitedGames = wishlist.games.slice(0, options.appLimit ?? DEFAULT_APP_LIMIT);
  const appDetails = await mapWithConcurrency(
    limitedGames,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (game) => fetchSteamAppDetails(game.appId, options),
  );

  const successfulDetails = appDetails.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const skippedAppIds = limitedGames.flatMap((game, index) =>
    appDetails[index]?.status === 'rejected' ? [game.appId] : [],
  );

  return {
    steamId64: wishlist.steamId64,
    wishlistUrl: wishlist.wishlistUrl,
    wishlistGames: limitedGames,
    appDetails: successfulDetails,
    skippedAppIds,
  };
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
): Promise<PromiseSettledResult<U>[]> {
  const results: PromiseSettledResult<U>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        results[currentIndex] = { status: 'fulfilled', value: await mapper(items[currentIndex]) };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
