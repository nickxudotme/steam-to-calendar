import {
  dropHistoricalLowWhenCurrencyMismatch,
  preferActiveStoreDealPrices,
  type CalendarEvent,
} from "@/domain/calendar/event-mapper";
import { STEAM_CLI_CACHE_TTL } from "@/integrations/steam/cache-policy";
import { runSteamCliJson } from "@/integrations/steam/cli";
import { mapWithConcurrency } from "@/integrations/steam/concurrency";
import { fetchSteamHistorySaleEvents } from "@/integrations/steam/history";

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
      currency?: string;
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
  price_insights?: {
    best_ever_deal?: SteamCliHistoricDeal;
    steam_store_low?: SteamCliHistoricDeal;
  };
};

type SteamCliAppReviewSummary = NonNullable<SteamCliApp["reviews"]>;
type SteamCliHistoricDeal = {
  date?: string;
  price?: string;
  store?: string;
};
type SteamCliGameMetadata = Pick<
  CalendarEvent,
  | "developers"
  | "genres"
  | "historicalLowDate"
  | "historicalLowPrice"
  | "historicalLowStore"
  | "publishers"
  | "releaseDateText"
  | "reviewCount"
  | "reviewPercentage"
  | "reviewSummary"
>;

type WatchedGameOptions = {
  cc?: string;
  historyDays?: number;
  lang?: string;
  today?: string;
  uiLang?: string;
  usePriceHistory?: boolean;
};

export type WatchedGameSnapshot = SteamCliGameMetadata & {
  appId: string;
  finalPrice?: string;
  imageUrl?: string;
  name: string;
  originalPrice?: string;
  price?: {
    currency?: string;
    discountPercent: number;
    finalFormatted?: string;
    initialFormatted?: string;
  };
  storeUrl: string;
  events: CalendarEvent[];
};

const WATCHED_GAME_CONCURRENCY = 3;

export async function fetchWatchedGameEvents(
  appIds: string[],
  options: WatchedGameOptions = {},
): Promise<CalendarEvent[]> {
  return (await fetchWatchedGameSnapshots(appIds, options)).flatMap((snapshot) => snapshot.events);
}

export async function fetchWatchedGameSnapshots(
  appIds: string[],
  options: WatchedGameOptions = {},
): Promise<WatchedGameSnapshot[]> {
  // Manual app IDs come from URLs/forms, so normalize aggressively before calling Steam.
  const uniqueAppIds = [...new Set(appIds)]
    .filter((appId) => /^\d{1,10}$/.test(appId))
    .slice(0, 25);

  const results = await mapWithConcurrency(
    uniqueAppIds,
    WATCHED_GAME_CONCURRENCY,
    async (appId) => {
      try {
        return await fetchWatchedGameSnapshot(appId, options);
      } catch {
        return null;
      }
    },
  );

  return results.filter((snapshot): snapshot is WatchedGameSnapshot => Boolean(snapshot));
}

async function fetchWatchedGameSnapshot(
  appId: string,
  options: WatchedGameOptions,
): Promise<WatchedGameSnapshot | null> {
  const app = await fetchSteamCliApp(appId, options);

  if (!app) {
    return null;
  }

  const snapshot = mapSteamCliAppToWatchedGameSnapshot(app, options);
  const historyEvents = await fetchSteamHistorySaleEvents(appId, {
    ...options,
    activeDiscountEnd: currentDiscountEnd(app),
    days: options.historyDays,
    imageUrl: app.details?.header_image,
    name: app.details?.name,
    review: app.details?.short_description,
    sourceUrl: snapshot.storeUrl,
    useHistory: options.usePriceHistory,
  });

  if (!historyEvents.length) {
    return snapshot;
  }

  // Price-history events are usually richer for deals; keep release events from the live app
  // snapshot so preorders/upcoming releases still appear.
  const releaseEvents = snapshot.events.filter((event) => event.type !== "steam_deal");

  return {
    ...snapshot,
    events: [
      ...preferActiveStoreDealPrices(historyEvents, {
        finalPrice: snapshot.finalPrice,
        originalPrice: snapshot.originalPrice,
      }).map((event) =>
        dropHistoricalLowWhenCurrencyMismatch(
          { ...event, ...steamCliGameMetadata(app) },
          options.cc,
        ),
      ),
      ...releaseEvents,
    ],
  };
}

async function fetchSteamCliApp(
  appId: string,
  options: WatchedGameOptions,
): Promise<SteamCliApp | null> {
  if (hasAdvancedPricingKey() && options.usePriceHistory !== false) {
    try {
      const enhancedApp = await runSteamCliJson<SteamCliApp>(["app", appId, "--enhanced"], {
        cacheTtlMs: STEAM_CLI_CACHE_TTL.watchedApp,
        cc: options.cc,
        lang: options.lang,
        processTimeoutMs: 30_000,
        uiLang: options.uiLang,
      });

      if (enhancedApp) {
        return enhancedApp;
      }
    } catch (error) {
      console.warn(
        [
          "[steam-app]",
          "status=fallback",
          "reason=enhanced_query_failed",
          `appId=${appId}`,
          errorLogPart(error),
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
  }

  return runSteamCliJson<SteamCliApp>(["app", appId], {
    cacheTtlMs: STEAM_CLI_CACHE_TTL.watchedApp,
    cc: options.cc,
    lang: options.lang,
    processTimeoutMs: 30_000,
    uiLang: options.uiLang,
  });
}

export function mapSteamCliAppToWatchedGameSnapshot(
  app: SteamCliApp,
  options: { today?: string } = {},
): WatchedGameSnapshot {
  const appId = String(app.appid);
  const name = app.details?.name?.trim() || `Steam app ${appId}`;
  const bestPurchase = app.store_item?.best_purchase_option;
  const finalPrice =
    bestPurchase?.formatted_final_price ?? app.details?.price_overview?.final_formatted;
  const originalPrice =
    bestPurchase?.formatted_original_price ?? app.details?.price_overview?.initial_formatted;
  const discountPercent =
    bestPurchase?.discount_pct ?? app.details?.price_overview?.discount_percent ?? 0;
  const currency = app.details?.price_overview?.currency?.trim();
  const metadata = steamCliGameMetadata(app);

  return {
    appId,
    name,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    ...(app.details?.header_image ? { imageUrl: app.details.header_image } : {}),
    ...(finalPrice ? { finalPrice } : {}),
    ...(originalPrice ? { originalPrice } : {}),
    ...(finalPrice || originalPrice || discountPercent > 0
      ? {
          price: {
            ...(currency ? { currency } : {}),
            discountPercent,
            ...(finalPrice ? { finalFormatted: finalPrice } : {}),
            ...(originalPrice ? { initialFormatted: originalPrice } : {}),
          },
        }
      : {}),
    ...metadata,
    events: mapSteamCliAppToWatchedEvents(app, options),
  };
}

export function mapSteamCliAppToWatchedEvents(
  app: SteamCliApp,
  options: { cc?: string; today?: string } = {},
): CalendarEvent[] {
  const today = options.today ?? todayIsoDate();
  const appId = String(app.appid);
  const name = app.details?.name?.trim() || `Steam app ${appId}`;
  const sourceUrl = `https://store.steampowered.com/app/${appId}/`;
  const bestPurchase = app.store_item?.best_purchase_option;
  const finalPrice =
    bestPurchase?.formatted_final_price ?? app.details?.price_overview?.final_formatted;
  const originalPrice =
    bestPurchase?.formatted_original_price ?? app.details?.price_overview?.initial_formatted;
  const discountPercent =
    bestPurchase?.discount_pct ?? app.details?.price_overview?.discount_percent ?? 0;
  const discountEnd = bestPurchase?.active_discounts?.find(
    (discount) => discount.discount_end_date,
  )?.discount_end_date;
  const imageUrl = app.details?.header_image;
  const shortDescription = app.details?.short_description?.trim();
  const metadata = steamCliGameMetadata(app);

  if (discountPercent > 0 && discountEnd) {
    // A discounted game becomes a date range from today through the discount end timestamp.
    const endDate = unixSecondsToIsoDate(discountEnd);

    return [
      dropHistoricalLowWhenCurrencyMismatch(
        {
          id: `steam-app-${appId}-watched-deal`,
          title: `-${discountPercent}% ${name}`,
          description: [
            shortDescription,
            finalPrice && originalPrice ? `Price: ${finalPrice} (was ${originalPrice})` : null,
            sourceUrl,
          ]
            .filter((part): part is string => Boolean(part))
            .join("\n"),
          startDate: today,
          endDate: endDate <= today ? addDays(today, 1) : endDate,
          sourceUrl,
          type: "steam_deal",
          dataSource: "steam_store",
          appId,
          discount: `-${discountPercent}%`,
          finalPrice,
          originalPrice,
          ...(imageUrl ? { imageUrl } : {}),
          discountEnd,
          ...metadata,
        },
        options.cc,
      ),
    ];
  }

  const releaseTime =
    app.store_item?.release?.steam_release_date ?? app.store_item?.release?.original_release_date;
  if (releaseTime) {
    // If there is no active discount, an unreleased watched game can still become a release event.
    const releaseDate = unixSecondsToIsoDate(releaseTime);

    if (releaseDate >= today) {
      return [
        {
          id: `steam-app-${appId}-watched-release`,
          title: `🎮 ${name} releases`,
          description: [
            shortDescription,
            finalPrice
              ? `Price: ${finalPrice}${originalPrice ? ` (was ${originalPrice})` : ""}`
              : null,
            app.details?.release_date?.date
              ? `Steam release date: ${app.details.release_date.date}`
              : null,
            sourceUrl,
          ]
            .filter((part): part is string => Boolean(part))
            .join("\n"),
          startDate: releaseDate,
          sourceUrl,
          type: "wishlist_release",
          dataSource: "steam_store",
          appId,
          finalPrice,
          originalPrice,
          ...(imageUrl ? { imageUrl } : {}),
          releaseTime,
          ...metadata,
        },
      ];
    }
  }

  return [];
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

function currentDiscountEnd(app: SteamCliApp): number | undefined {
  return app.store_item?.best_purchase_option?.active_discounts?.find(
    (discount) => discount.discount_end_date,
  )?.discount_end_date;
}

function steamCliGameMetadata(app: SteamCliApp): SteamCliGameMetadata {
  // Steam exposes overlapping metadata in multiple shapes; this function collapses it into the
  // compact display fields used by preview cards and event details.
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

  if (typeof review.reviewPercentage === "number") {
    metadata.reviewPercentage = review.reviewPercentage;
  }

  if (typeof review.reviewCount === "number") {
    metadata.reviewCount = review.reviewCount;
  }

  const historicalLow = readHistoricalLow(app.price_insights);
  if (historicalLow) {
    metadata.historicalLowPrice = historicalLow.price;
    metadata.historicalLowDate = historicalLow.date;
    if (historicalLow.store) {
      metadata.historicalLowStore = historicalLow.store;
    }
  }

  return metadata;
}

function readHistoricalLow(
  priceInsights: SteamCliApp["price_insights"],
): { date: string; price: string; store?: string } | null {
  const deal = priceInsights?.best_ever_deal ?? priceInsights?.steam_store_low;

  if (!deal?.price || !deal.date || !isIsoDate(deal.date)) {
    return null;
  }

  return {
    date: deal.date,
    price: deal.price,
    ...(deal.store ? { store: deal.store } : {}),
  };
}

function readReviewSummary(
  appReviews: SteamCliAppReviewSummary | undefined,
  storeReviews: NonNullable<SteamCliApp["store_item"]>["reviews"] | undefined,
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

function readDescribedList(
  values: Array<{ description?: string; name?: string }> | undefined,
): string[] {
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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasAdvancedPricingKey(): boolean {
  return Boolean(process.env.STEAM_CLI_ITAD_KEY?.trim());
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function errorLogPart(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return `error=${JSON.stringify(error.message)}`;
  }

  return `error=${JSON.stringify(String(error))}`;
}
