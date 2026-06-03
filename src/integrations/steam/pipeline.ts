import {
  fetchSteamAppDetails,
  fetchSteamProfileSummary,
  fetchSteamWishlist,
  isExactSteamReleaseDate,
  normalizeSteamProfileInput,
  type SteamAppDetails,
  type SteamProfileSummary,
  type SteamWishlistGame,
} from "@/integrations/steam/client";
import { STEAM_CLI_CACHE_TTL } from "@/integrations/steam/cache-policy";
import { runSteamCliJson } from "@/integrations/steam/cli";
import { mapSettledWithConcurrency } from "@/integrations/steam/concurrency";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type WishlistCalendarData = {
  steamId64: string;
  profileName: string | null;
  wishlistUrl: string;
  wishlistGames: SteamWishlistGame[];
  appDetails: SteamAppDetails[];
  skippedAppIds: string[];
};

const DEFAULT_APP_LIMIT = 100;
const DEFAULT_CONCURRENCY = 5;

export async function fetchWishlistCalendarData(
  input: string,
  options: {
    cc?: string;
    fetcher?: FetchLike;
    appLimit?: number;
    concurrency?: number;
    lang?: string;
    timeoutMs?: number;
    uiLang?: string;
  } = {},
): Promise<WishlistCalendarData> {
  if (!options.fetcher) {
    // Prefer steam-cli in production/dev because it already handles Steam's quirks and gives us
    // richer wishlist data. Tests pass a fetcher to exercise the pure HTTP fallback.
    const cliData = await fetchWishlistCalendarDataFromCli(input, options);
    if (cliData) {
      return {
        ...cliData,
        profileName: await fetchSteamProfileSummaryFromCli(input, options).catch(() => null),
      };
    }
  }

  const [wishlist, profile] = await Promise.all([
    fetchSteamWishlist(input, options),
    fetchSteamProfileSummary(input, options).catch(() => null),
  ]);
  const limitedGames = wishlist.games.slice(0, options.appLimit ?? DEFAULT_APP_LIMIT);
  // App details are best-effort enrichment; one failed app should not break the whole wishlist.
  const appDetails = await mapSettledWithConcurrency(
    limitedGames,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (game) => fetchSteamAppDetails(game.appId, options),
  );

  const successfulDetails = appDetails.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const detailsByAppId = new Map(successfulDetails.map((details) => [details.appId, details]));
  const wishlistGames = limitedGames.map((game) => {
    const details = detailsByAppId.get(game.appId);

    return details ? mergeWishlistGameDetails(game, details) : game;
  });
  const skippedAppIds = limitedGames.flatMap((game, index) =>
    appDetails[index]?.status === "rejected" ? [game.appId] : [],
  );

  return {
    steamId64: wishlist.steamId64,
    profileName: profile?.displayName ?? null,
    wishlistUrl: wishlist.wishlistUrl,
    wishlistGames,
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

type SteamCliUserProfile = SteamProfileSummary & {
  steamid?: string;
  steamid64: string;
};

type SteamCliWishlistItem = {
  appid: number;
  details?: {
    developers?: string[];
    genres?: Array<{
      description?: string;
      name?: string;
    }>;
    header_image?: string;
    name?: string;
    price_overview?: {
      currency?: string;
      discount_percent?: number;
      final_formatted?: string;
      initial_formatted?: string;
    };
    publishers?: string[];
    recommendations?: {
      total?: number;
    };
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
  options: { appLimit?: number; cc?: string; lang?: string; timeoutMs?: number; uiLang?: string },
): Promise<WishlistCalendarData | null> {
  const steamInput = normalizeSteamProfileInput(input);
  const appLimit = options.appLimit ?? DEFAULT_APP_LIMIT;
  const data = await runSteamCliJson<SteamCliWishlist>(
    ["wishlist", steamInput, "--count", String(appLimit)],
    {
      cacheTtlMs: STEAM_CLI_CACHE_TTL.wishlist,
      cc: options.cc,
      lang: options.lang,
      processTimeoutMs: options.timeoutMs,
      uiLang: options.uiLang,
    },
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
    const detailMetadata = item.details ? steamCliWishlistGameMetadata(item.details) : {};

    return {
      appId,
      name: item.details?.name?.trim() || `Steam app ${appId}`,
      releaseDateText,
      storeUrl: steamStoreUrl(appId),
      ...detailMetadata,
    };
  });

  const appDetails = data.items.flatMap((item) => {
    if (!item.details) {
      return [];
    }

    const appId = String(item.details.steam_appid ?? item.appid);
    const releaseDateText = item.details.release_date?.date?.trim() || null;
    const detailMetadata = steamCliWishlistGameMetadata(item.details);

    return [
      {
        appId,
        name: item.details.name?.trim() || `Steam app ${appId}`,
        releaseDateText,
        hasExactReleaseDate: isExactSteamReleaseDate(releaseDateText),
        storeUrl: steamStoreUrl(appId),
        ...detailMetadata,
      },
    ];
  });

  // The CLI can return per-item failures. Surface them as skipped IDs for stats/debugging while
  // still using every successful item.
  const skippedAppIds = data.items.flatMap((item) =>
    item.error || !item.details ? [String(item.appid)] : [],
  );

  return {
    steamId64: data.steamid64,
    profileName: null,
    wishlistUrl: `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${data.steamid64}`,
    wishlistGames,
    appDetails,
    skippedAppIds,
  };
}

async function fetchSteamProfileSummaryFromCli(
  input: string,
  options: { cc?: string; lang?: string; timeoutMs?: number; uiLang?: string },
): Promise<string | null> {
  const steamInput = normalizeSteamProfileInput(input);
  const data = await runSteamCliJson<SteamCliUserProfile>(["user", steamInput], {
    cacheTtlMs: STEAM_CLI_CACHE_TTL.wishlist,
    cc: options.cc,
    lang: options.lang,
    processTimeoutMs: options.timeoutMs,
    uiLang: options.uiLang,
  });

  return data?.steamid?.trim() || data?.displayName?.trim() || null;
}

function steamStoreUrl(appId: string): string {
  return `https://store.steampowered.com/app/${appId}/`;
}

function mergeWishlistGameDetails(
  game: SteamWishlistGame,
  details: SteamAppDetails,
): SteamWishlistGame {
  return {
    ...game,
    ...(details.imageUrl && !game.imageUrl ? { imageUrl: details.imageUrl } : {}),
    ...(details.price && !game.price ? { price: details.price } : {}),
    ...(details.genres?.length && !game.genres?.length ? { genres: details.genres } : {}),
    ...(details.developers?.length && !game.developers?.length
      ? { developers: details.developers }
      : {}),
    ...(details.publishers?.length && !game.publishers?.length
      ? { publishers: details.publishers }
      : {}),
    ...(details.reviewCount && !game.reviewCount ? { reviewCount: details.reviewCount } : {}),
    releaseDateText: game.releaseDateText ?? details.releaseDateText,
  };
}

function steamCliWishlistGameMetadata(
  details: NonNullable<SteamCliWishlistItem["details"]>,
): Pick<
  SteamWishlistGame,
  "developers" | "genres" | "imageUrl" | "price" | "publishers" | "reviewCount"
> {
  const imageUrl = details.header_image?.trim();
  const genres = uniqueStrings(
    (details.genres ?? []).flatMap((genre) => {
      const value = genre.description?.trim() || genre.name?.trim();
      return value ? [value] : [];
    }),
  ).slice(0, 4);
  const developers = uniqueStrings(details.developers ?? []).slice(0, 2);
  const publishers = uniqueStrings(details.publishers ?? []).slice(0, 2);
  const price = details.price_overview
    ? {
        ...(details.price_overview.currency ? { currency: details.price_overview.currency } : {}),
        discountPercent: details.price_overview.discount_percent ?? 0,
        ...(details.price_overview.final_formatted
          ? { finalFormatted: details.price_overview.final_formatted }
          : {}),
        ...(details.price_overview.initial_formatted
          ? { initialFormatted: details.price_overview.initial_formatted }
          : {}),
      }
    : null;
  const reviewCount = details.recommendations?.total;

  return {
    ...(imageUrl ? { imageUrl } : {}),
    ...(price ? { price } : {}),
    ...(genres.length ? { genres } : {}),
    ...(developers.length ? { developers } : {}),
    ...(publishers.length ? { publishers } : {}),
    ...(reviewCount ? { reviewCount } : {}),
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
