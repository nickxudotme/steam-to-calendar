import {
  fetchSteamAppDetails,
  fetchSteamWishlist,
  isExactSteamReleaseDate,
  normalizeSteamProfileInput,
  type SteamAppDetails,
  type SteamWishlistGame,
} from '@/lib/steam/client';
import { runSteamCliJson } from '@/lib/steam/cli';

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
  if (!options.fetcher) {
    const cliData = await fetchWishlistCalendarDataFromCli(input, options);
    if (cliData) {
      return cliData;
    }
  }

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

type SteamCliWishlist = {
  steamid64: string;
  items: SteamCliWishlistItem[];
  total: number;
  offset: number;
  count: number;
};

type SteamCliWishlistItem = {
  appid: number;
  details?: {
    name?: string;
    steam_appid?: number;
    release_date?: {
      coming_soon?: boolean;
      date?: string;
    };
  };
  error?: string;
};

async function fetchWishlistCalendarDataFromCli(
  input: string,
  options: { appLimit?: number; timeoutMs?: number },
): Promise<WishlistCalendarData | null> {
  const steamInput = normalizeSteamProfileInput(input);
  const appLimit = options.appLimit ?? DEFAULT_APP_LIMIT;
  const data = await runSteamCliJson<SteamCliWishlist>(
    ['wishlist', steamInput, '--count', String(appLimit)],
    { processTimeoutMs: options.timeoutMs },
  );

  if (!data) {
    return null;
  }

  return mapSteamCliWishlist(data);
}

export function mapSteamCliWishlist(data: SteamCliWishlist): WishlistCalendarData {
  const wishlistGames = data.items.map((item) => {
    const appId = String(item.appid);
    const releaseDateText = item.details?.release_date?.date?.trim() || null;

    return {
      appId,
      name: item.details?.name?.trim() || `Steam app ${appId}`,
      releaseDateText,
      storeUrl: steamStoreUrl(appId),
    };
  });

  const appDetails = data.items.flatMap((item) => {
    if (!item.details) {
      return [];
    }

    const appId = String(item.details.steam_appid ?? item.appid);
    const releaseDateText = item.details.release_date?.date?.trim() || null;

    return [{
      appId,
      name: item.details.name?.trim() || `Steam app ${appId}`,
      releaseDateText,
      hasExactReleaseDate: isExactSteamReleaseDate(releaseDateText),
      storeUrl: steamStoreUrl(appId),
    }];
  });

  const skippedAppIds = data.items.flatMap((item) => (
    item.error || !item.details ? [String(item.appid)] : []
  ));

  return {
    steamId64: data.steamid64,
    wishlistUrl: `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${data.steamid64}`,
    wishlistGames,
    appDetails,
    skippedAppIds,
  };
}

function steamStoreUrl(appId: string): string {
  return `https://store.steampowered.com/app/${appId}/`;
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
