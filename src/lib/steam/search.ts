import { STEAM_CLI_CACHE_TTL } from '@/lib/steam/cache-policy';
import { runSteamCliJson } from '@/lib/steam/cli';

export type SteamSearchResult = {
  appId: string;
  name: string;
  imageUrl?: string;
  price?: {
    discountPercent: number;
    finalFormatted?: string;
    initialFormatted?: string;
  };
  storeUrl: string;
};

type SteamCliSearchResult = {
  id: number;
  name: string;
  type?: string;
  tiny_image?: string;
  price?: {
    discount_percent?: number;
    final_formatted?: string;
    initial_formatted?: string;
  };
};

type SteamCliAppSearchResult = {
  appid: number;
  details?: {
    header_image?: string;
    name?: string;
    price_overview?: {
      discount_percent?: number;
      final_formatted?: string;
      initial_formatted?: string;
    };
  };
  store_item?: {
    best_purchase_option?: {
      discount_pct?: number;
      formatted_final_price?: string;
      formatted_original_price?: string;
    };
  };
};

export async function searchSteamGames(
  query: string,
  options: { cc?: string; count?: number; lang?: string; uiLang?: string } = {},
): Promise<SteamSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const directAppId = parseSteamAppInput(normalizedQuery);
  if (directAppId) {
    const game = await fetchSteamGameByAppId(directAppId, options);
    return game ? [game] : [];
  }

  const data = await runSteamCliJson<SteamCliSearchResult[]>([
    'search',
    normalizedQuery,
    '--count',
    String(options.count ?? 8),
  ], {
    cacheTtlMs: STEAM_CLI_CACHE_TTL.search,
    cc: options.cc,
    lang: options.lang,
    uiLang: options.uiLang,
  });

  if (!data) {
    return [];
  }

  return data
    .filter((result) => result.type === 'app')
    .map((result) => {
      const appId = String(result.id);

      return {
        appId,
        name: result.name,
        storeUrl: `https://store.steampowered.com/app/${appId}/`,
        ...(result.tiny_image ? { imageUrl: result.tiny_image } : {}),
        ...(result.price ? {
          price: {
            discountPercent: result.price.discount_percent ?? 0,
            ...(result.price.final_formatted ? { finalFormatted: result.price.final_formatted } : {}),
            ...(result.price.initial_formatted ? { initialFormatted: result.price.initial_formatted } : {}),
          },
        } : {}),
      };
    });
}

export function parseSteamAppInput(input: string): string | null {
  const trimmed = input.trim();

  if (/^\d{1,10}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const isSteamHost = url.hostname === 'store.steampowered.com' || url.hostname.endsWith('.steampowered.com');
    const match = url.pathname.match(/\/app\/(\d{1,10})(?:\/|$)/);

    return isSteamHost && match ? match[1] : null;
  } catch {
    return null;
  }
}

async function fetchSteamGameByAppId(
  appId: string,
  options: { cc?: string; lang?: string; uiLang?: string },
): Promise<SteamSearchResult | null> {
  const data = await runSteamCliJson<SteamCliAppSearchResult>([
    'app',
    appId,
  ], {
    cacheTtlMs: STEAM_CLI_CACHE_TTL.watchedApp,
    cc: options.cc,
    lang: options.lang,
    processTimeoutMs: 30_000,
    uiLang: options.uiLang,
  });

  if (!data) {
    return null;
  }

  const name = data.details?.name?.trim() || `Steam app ${appId}`;
  const bestPurchase = data.store_item?.best_purchase_option;
  const discountPercent = bestPurchase?.discount_pct ?? data.details?.price_overview?.discount_percent ?? 0;

  return {
    appId: String(data.appid || appId),
    name,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    ...(data.details?.header_image ? { imageUrl: data.details.header_image } : {}),
    price: {
      discountPercent,
      ...(bestPurchase?.formatted_final_price ?? data.details?.price_overview?.final_formatted
        ? { finalFormatted: bestPurchase?.formatted_final_price ?? data.details?.price_overview?.final_formatted }
        : {}),
      ...(bestPurchase?.formatted_original_price ?? data.details?.price_overview?.initial_formatted
        ? { initialFormatted: bestPurchase?.formatted_original_price ?? data.details?.price_overview?.initial_formatted }
        : {}),
    },
  };
}
