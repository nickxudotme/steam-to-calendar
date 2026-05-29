import { STEAM_CLI_CACHE_TTL } from "@/integrations/steam/cache-policy";
import { runSteamCliJson } from "@/integrations/steam/cli";

export type SteamSearchResult = {
  appId: string;
  name: string;
  imageUrl?: string;
  genres?: string[];
  price?: {
    discountPercent: number;
    finalFormatted?: string;
    initialFormatted?: string;
  };
  reviewCount?: number;
  reviewPercentage?: number;
  reviewSummary?: string;
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
    genres?: Array<{
      description?: string;
      name?: string;
    }>;
    header_image?: string;
    name?: string;
    price_overview?: {
      discount_percent?: number;
      final_formatted?: string;
      initial_formatted?: string;
    };
  };
  reviews?: {
    review_score_desc?: string;
    total_negative?: number;
    total_positive?: number;
    total_reviews?: number;
  };
  store_item?: {
    best_purchase_option?: {
      discount_pct?: number;
      formatted_final_price?: string;
      formatted_original_price?: string;
    };
    reviews?: {
      summary_filtered?: {
        percent_positive?: number;
        review_count?: number;
        review_score_label?: string;
      };
      summary_language_specific?: {
        percent_positive?: number;
        review_count?: number;
        review_score_label?: string;
      };
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
  const data = await runSteamCliJson<SteamCliSearchResult[]>(
    ["search", query, "--count", String(options.count ?? 8)],
    {
      cacheTtlMs: STEAM_CLI_CACHE_TTL.search,
      cc: options.cc,
      lang: options.lang,
      uiLang: options.uiLang,
    },
  );

  if (!data) {
    return [];
  }

  const results = data
    .filter((result) => result.type === "app")
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
        ...(result.price
          ? {
              price: {
                discountPercent: result.price.discount_percent ?? 0,
                ...(finalFormatted ? { finalFormatted } : {}),
                ...(initialFormatted ? { initialFormatted } : {}),
              },
            }
          : {}),
      };
    });

  return enrichSearchResults(results, options);
}

export function parseSteamAppInput(input: string): string | null {
  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);
    const isSteamHost =
      url.hostname === "store.steampowered.com" || url.hostname.endsWith(".steampowered.com");
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
  locale = "en",
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
      style: "currency",
    }).format((amountInMinorUnits ?? 0) / 100);
  } catch {
    return `${currency} ${((amountInMinorUnits ?? 0) / 100).toFixed(2)}`;
  }
}

async function fetchSteamGameByAppId(
  appId: string,
  options: { cc?: string; lang?: string; uiLang?: string },
): Promise<SteamSearchResult | null> {
  const data = await runSteamCliJson<SteamCliAppSearchResult>(["app", appId], {
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
  const discountPercent =
    bestPurchase?.discount_pct ?? data.details?.price_overview?.discount_percent ?? 0;
  const metadata = steamAppSearchMetadata(data);

  return {
    appId: String(data.appid || appId),
    name,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    ...(data.details?.header_image ? { imageUrl: data.details.header_image } : {}),
    price: {
      discountPercent,
      ...((bestPurchase?.formatted_final_price ?? data.details?.price_overview?.final_formatted)
        ? {
            finalFormatted:
              bestPurchase?.formatted_final_price ?? data.details?.price_overview?.final_formatted,
          }
        : {}),
      ...((bestPurchase?.formatted_original_price ??
      data.details?.price_overview?.initial_formatted)
        ? {
            initialFormatted:
              bestPurchase?.formatted_original_price ??
              data.details?.price_overview?.initial_formatted,
          }
        : {}),
    },
    ...metadata,
  };
}

async function enrichSearchResults(
  results: SteamSearchResult[],
  options: { cc?: string; lang?: string; uiLang?: string },
): Promise<SteamSearchResult[]> {
  const enriched = await mapWithConcurrency(results, 3, async (result) => {
    const app = await fetchSteamGameByAppId(result.appId, options).catch(() => null);
    if (!app) {
      return result;
    }

    return {
      ...result,
      imageUrl: app.imageUrl ?? result.imageUrl,
      genres: app.genres,
      reviewCount: app.reviewCount,
      reviewPercentage: app.reviewPercentage,
      reviewSummary: app.reviewSummary,
    };
  });

  return enriched;
}

function steamAppSearchMetadata(
  app: SteamCliAppSearchResult,
): Pick<SteamSearchResult, "genres" | "reviewCount" | "reviewPercentage" | "reviewSummary"> {
  const review = readReviewSummary(app.reviews, app.store_item?.reviews);
  const genres = uniqueStrings(
    (app.details?.genres ?? []).flatMap((genre) => {
      const value = genre.description?.trim() || genre.name?.trim();
      return value ? [value] : [];
    }),
  ).slice(0, 3);

  return {
    ...(genres.length ? { genres } : {}),
    ...review,
  };
}

function readReviewSummary(
  appReviews: SteamCliAppSearchResult["reviews"] | undefined,
  storeReviews: NonNullable<SteamCliAppSearchResult["store_item"]>["reviews"] | undefined,
): Pick<SteamSearchResult, "reviewCount" | "reviewPercentage" | "reviewSummary"> {
  const storeSummary = storeReviews?.summary_filtered ?? storeReviews?.summary_language_specific;
  const totalPositive = numberOrNull(appReviews?.total_positive);
  const totalNegative = numberOrNull(appReviews?.total_negative);
  const appReviewCount = numberOrNull(appReviews?.total_reviews);
  const storeReviewCount = numberOrNull(storeSummary?.review_count);
  const reviewCount =
    storeReviewCount ??
    appReviewCount ??
    (totalPositive !== null && totalNegative !== null ? totalPositive + totalNegative : null);
  const explicitPercentage = numberOrNull(storeSummary?.percent_positive);
  const computedPercentage =
    explicitPercentage ??
    (totalPositive !== null && reviewCount && reviewCount > 0
      ? Math.round((totalPositive / reviewCount) * 100)
      : null);
  const reviewLabel =
    storeSummary?.review_score_label?.trim() || appReviews?.review_score_desc?.trim();

  return {
    ...(reviewLabel ? { reviewSummary: reviewLabel } : {}),
    ...(computedPercentage !== null ? { reviewPercentage: computedPercentage } : {}),
    ...(reviewCount !== null && reviewCount > 0 ? { reviewCount } : {}),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
