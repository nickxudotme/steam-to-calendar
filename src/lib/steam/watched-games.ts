import type { CalendarEvent } from '@/lib/events/mapper';
import { STEAM_CLI_CACHE_TTL } from '@/lib/steam/cache-policy';
import { runSteamCliJson } from '@/lib/steam/cli';

type SteamCliApp = {
  appid: number;
  details?: {
    categories?: Array<{
      description?: string;
      name?: string;
    }>;
    developers?: string[];
    genres?: Array<{
      description?: string;
      name?: string;
    }>;
    header_image?: string;
    name?: string;
    publishers?: string[];
    price_overview?: {
      discount_percent?: number;
      final_formatted?: string;
      initial_formatted?: string;
    };
    release_date?: {
      coming_soon?: boolean;
      date?: string;
    };
    short_description?: string;
  };
  reviews?: {
    review_score?: number;
    review_score_desc?: string;
    total_negative?: number;
    total_positive?: number;
    total_reviews?: number;
  };
  store_item?: {
    best_purchase_option?: {
      active_discounts?: Array<{
        discount_end_date?: number;
      }>;
      discount_pct?: number;
      formatted_final_price?: string;
      formatted_original_price?: string;
    };
    release?: {
      original_release_date?: number;
      steam_release_date?: number;
    };
    reviews?: {
      summary_filtered?: {
        percent_positive?: number;
        review_count?: number;
        review_score?: number;
        review_score_label?: string;
      };
      summary_language_specific?: {
        percent_positive?: number;
        review_count?: number;
        review_score?: number;
        review_score_label?: string;
      };
    };
    tags?: Array<{
      name?: string;
      tag_name?: string;
    }>;
  };
};

type SteamCliAppReviewSummary = NonNullable<SteamCliApp['reviews']>;
type SteamCliGameMetadata = Pick<
CalendarEvent,
'developers' | 'genres' | 'publishers' | 'releaseDateText' | 'reviewCount' | 'reviewPercentage' | 'reviewSummary'
>;

const WATCHED_GAME_CONCURRENCY = 3;

export async function fetchWatchedGameEvents(
  appIds: string[],
  options: { cc?: string; lang?: string; today?: string; uiLang?: string } = {},
): Promise<CalendarEvent[]> {
  const uniqueAppIds = [...new Set(appIds)].filter((appId) => /^\d{1,10}$/.test(appId)).slice(0, 25);

  const results = await mapWithConcurrency(uniqueAppIds, WATCHED_GAME_CONCURRENCY, async (appId) => {
    try {
      return await fetchWatchedGameEvent(appId, options);
    } catch {
      return [];
    }
  });

  return results.flat();
}

async function fetchWatchedGameEvent(
  appId: string,
  options: { cc?: string; lang?: string; today?: string; uiLang?: string },
): Promise<CalendarEvent[]> {
  const app = await runSteamCliJson<SteamCliApp>([
    'app',
    appId,
  ], {
    cacheTtlMs: STEAM_CLI_CACHE_TTL.watchedApp,
    cc: options.cc,
    lang: options.lang,
    processTimeoutMs: 30_000,
    uiLang: options.uiLang,
  });

  if (!app) {
    return [];
  }

  return mapSteamCliAppToWatchedEvents(app, options);
}

export function mapSteamCliAppToWatchedEvents(
  app: SteamCliApp,
  options: { today?: string } = {},
): CalendarEvent[] {
  const today = options.today ?? todayIsoDate();
  const appId = String(app.appid);
  const name = app.details?.name?.trim() || `Steam app ${appId}`;
  const sourceUrl = `https://store.steampowered.com/app/${appId}/`;
  const bestPurchase = app.store_item?.best_purchase_option;
  const discountPercent = bestPurchase?.discount_pct ?? app.details?.price_overview?.discount_percent ?? 0;
  const discountEnd = bestPurchase?.active_discounts?.find((discount) => discount.discount_end_date)?.discount_end_date;
  const imageUrl = app.details?.header_image;
  const shortDescription = app.details?.short_description?.trim();
  const metadata = steamCliGameMetadata(app);

  if (discountPercent > 0 && discountEnd) {
    const endDate = unixSecondsToIsoDate(discountEnd);

    return [{
      id: `steam-app-${appId}-watched-deal`,
      title: `-${discountPercent}% ${name}`,
      description: [
        shortDescription,
        bestPurchase?.formatted_final_price && bestPurchase.formatted_original_price
          ? `Price: ${bestPurchase.formatted_final_price} (was ${bestPurchase.formatted_original_price})`
          : null,
        sourceUrl,
      ].filter((part): part is string => Boolean(part)).join('\n'),
      startDate: today,
      endDate: endDate <= today ? addDays(today, 1) : endDate,
      sourceUrl,
      type: 'steam_deal',
      appId,
      discount: `-${discountPercent}%`,
      finalPrice: bestPurchase?.formatted_final_price ?? app.details?.price_overview?.final_formatted,
      originalPrice: bestPurchase?.formatted_original_price ?? app.details?.price_overview?.initial_formatted,
      ...(imageUrl ? { imageUrl } : {}),
      discountEnd,
      ...metadata,
    }];
  }

  const releaseTime = app.store_item?.release?.steam_release_date ?? app.store_item?.release?.original_release_date;
  if (releaseTime) {
    const releaseDate = unixSecondsToIsoDate(releaseTime);

    if (releaseDate >= today) {
      return [{
        id: `steam-app-${appId}-watched-release`,
        title: `🎮 ${name} releases`,
        description: [
          shortDescription,
          app.details?.release_date?.date ? `Steam release date: ${app.details.release_date.date}` : null,
          sourceUrl,
        ].filter((part): part is string => Boolean(part)).join('\n'),
        startDate: releaseDate,
        sourceUrl,
        type: 'wishlist_release',
        appId,
        ...(imageUrl ? { imageUrl } : {}),
        releaseTime,
        ...metadata,
      }];
    }
  }

  return [];
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

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

function unixSecondsToIsoDate(value: number): string {
  return new Date(value * 1000).toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function steamCliGameMetadata(app: SteamCliApp): SteamCliGameMetadata {
  const review = readReviewSummary(app.reviews, app.store_item?.reviews);
  const genres = readDescribedList(app.details?.genres)
    .concat(readNamedList(app.store_item?.tags))
    .concat(readDescribedList(app.details?.categories));
  const metadata: SteamCliGameMetadata = {};

  const uniqueGenres = uniqueStrings(genres).slice(0, 4);
  const developers = uniqueStrings(app.details?.developers ?? []).slice(0, 2);
  const publishers = uniqueStrings(app.details?.publishers ?? []).slice(0, 2);
  const releaseDateText = app.details?.release_date?.date?.trim();

  if (uniqueGenres.length) {
    metadata.genres = uniqueGenres;
  }

  if (developers.length) {
    metadata.developers = developers;
  }

  if (publishers.length) {
    metadata.publishers = publishers;
  }

  if (releaseDateText) {
    metadata.releaseDateText = releaseDateText;
  }

  if (review.reviewSummary) {
    metadata.reviewSummary = review.reviewSummary;
  }

  if (typeof review.reviewPercentage === 'number') {
    metadata.reviewPercentage = review.reviewPercentage;
  }

  if (typeof review.reviewCount === 'number') {
    metadata.reviewCount = review.reviewCount;
  }

  return metadata;
}

function readReviewSummary(
  appReviews: SteamCliAppReviewSummary | undefined,
  storeReviews: NonNullable<SteamCliApp['store_item']>['reviews'] | undefined,
): {
  reviewCount?: number;
  reviewPercentage?: number;
  reviewSummary?: string;
} {
  const storeSummary = storeReviews?.summary_filtered ?? storeReviews?.summary_language_specific;
  const totalPositive = numberOrNull(appReviews?.total_positive);
  const totalNegative = numberOrNull(appReviews?.total_negative);
  const appReviewCount = numberOrNull(appReviews?.total_reviews);
  const storeReviewCount = numberOrNull(storeSummary?.review_count);
  const reviewCount = storeReviewCount ?? appReviewCount ?? (
    totalPositive !== null && totalNegative !== null ? totalPositive + totalNegative : null
  );
  const explicitPercentage = numberOrNull(storeSummary?.percent_positive);
  const computedPercentage = explicitPercentage ?? (
    totalPositive !== null && reviewCount && reviewCount > 0
      ? Math.round((totalPositive / reviewCount) * 100)
      : null
  );
  const reviewLabel = storeSummary?.review_score_label?.trim() || appReviews?.review_score_desc?.trim();

  return {
    ...(reviewLabel ? { reviewSummary: reviewLabel } : {}),
    ...(computedPercentage !== null ? { reviewPercentage: computedPercentage } : {}),
    ...(reviewCount !== null && reviewCount > 0 ? { reviewCount } : {}),
  };
}

function readDescribedList(values: Array<{ description?: string; name?: string }> | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((item) => {
    const value = item.description?.trim() || item.name?.trim();
    return value ? [value] : [];
  });
}

function readNamedList(values: Array<{ name?: string; tag_name?: string }> | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((item) => {
    const value = item.name?.trim() || item.tag_name?.trim();
    return value ? [value] : [];
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
