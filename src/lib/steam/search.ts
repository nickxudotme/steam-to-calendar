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

export async function searchSteamGames(
  query: string,
  options: { cc?: string; count?: number; lang?: string; uiLang?: string } = {},
): Promise<SteamSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
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
