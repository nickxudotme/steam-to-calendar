import type { CalendarEvent } from '@/lib/events/mapper';
import { STEAM_CLI_CACHE_TTL } from '@/lib/steam/cache-policy';
import { runSteamCliJson } from '@/lib/steam/cli';

type SteamCliApp = {
  appid: number;
  details?: {
    header_image?: string;
    name?: string;
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
  };
};

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

  if (discountPercent > 0 && discountEnd) {
    const endDate = unixSecondsToIsoDate(discountEnd);

    return [{
      id: `steam-app-${appId}-watched-deal`,
      title: `-${discountPercent}% ${name}`,
      description: [
        `${name} is one of your watched Steam games and is currently discounted.`,
        bestPurchase?.formatted_final_price && bestPurchase.formatted_original_price
          ? `Price: ${bestPurchase.formatted_final_price} (was ${bestPurchase.formatted_original_price})`
          : null,
        `Deal shown from now until Steam reports it ends.`,
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
          `${name} is one of your watched Steam games.`,
          app.details?.release_date?.date ? `Steam release date: ${app.details.release_date.date}` : null,
          sourceUrl,
        ].filter((part): part is string => Boolean(part)).join('\n'),
        startDate: releaseDate,
        sourceUrl,
        type: 'wishlist_release',
        appId,
        ...(imageUrl ? { imageUrl } : {}),
        releaseTime,
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
