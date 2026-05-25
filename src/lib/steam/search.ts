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
    currency?: string;
    discount_percent?: number;
    final?: number;
    final_formatted?: string;
    initial?: number;
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

  return searchSteamGamesByText(normalizedQuery, options);
}

async function searchSteamGamesByText(
  query: string,
  options: { cc?: string; count?: number; lang?: string; uiLang?: string } = {},
): Promise<SteamSearchResult[]> {
  const data = await runSteamCliJson<SteamCliSearchResult[]>([
    'search',
    query,
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
      const finalFormatted = searchPriceFormatted(
        result.price?.final_formatted,
        result.price?.final,
        result.price?.currency,
        options.uiLang,
      );
      const initialFormatted = searchPriceFormatted(
        result.price?.initial_formatted,
        result.price?.initial,
        result.price?.currency,
        options.uiLang,
      );

      return {
        appId,
        name: result.name,
        storeUrl: `https://store.steampowered.com/app/${appId}/`,
        ...(result.tiny_image ? { imageUrl: result.tiny_image } : {}),
        ...(result.price ? {
          price: {
            discountPercent: result.price.discount_percent ?? 0,
            ...(finalFormatted ? { finalFormatted } : {}),
            ...(initialFormatted ? { initialFormatted } : {}),
          },
        } : {}),
      };
    });
}

export function parseSteamAppInput(input: string): string | null {
  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);
    const isSteamHost = url.hostname === 'store.steampowered.com' || url.hostname.endsWith('.steampowered.com');
    const match = url.pathname.match(/\/app\/(\d{1,10})(?:\/|$)/);

    return isSteamHost && match ? match[1] : null;
  } catch {
    return null;
  }
}

export function searchPriceFormatted(
  formatted: string | undefined,
  amountInMinorUnits: number | undefined,
  currency: string | undefined,
  locale = 'en',
): string | undefined {
  const trimmed = formatted?.trim();

  if (trimmed) {
    return trimmed;
  }

  if (!Number.isFinite(amountInMinorUnits) || !currency) {
    return undefined;
  }

  try {
    return new Intl.NumberFormat(locale, {
      currency,
      style: 'currency',
    }).format((amountInMinorUnits ?? 0) / 100);
  } catch {
    return `${currency} ${((amountInMinorUnits ?? 0) / 100).toFixed(2)}`;
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
