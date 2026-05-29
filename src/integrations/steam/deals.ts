import {
  dropHistoricalLowWhenCurrencyMismatch,
  mapSteamDealEvents,
  type CalendarEvent,
  preferActiveStoreDealPrices,
  type SteamDealItem,
} from "@/domain/calendar/event-mapper";
import { STEAM_CLI_CACHE_TTL } from "@/integrations/steam/cache-policy";
import { runSteamCliJson } from "@/integrations/steam/cli";
import { fetchSteamHistorySaleEvents } from "@/integrations/steam/history";

export type SteamMediaAsset = {
  available?: boolean;
  kind?: string;
  name: string;
  status?: number;
  url: string;
};

export type SteamMedia = {
  header_image?: string;
  cdn_assets?: SteamMediaAsset[];
};

type SteamDealEventOptions = {
  cc?: string;
  count?: number;
  historyDays?: number;
  lang?: string;
  today?: string;
  uiLang?: string;
  usePriceHistory?: boolean;
};

type SteamCliHistoricDeal = {
  date?: string;
  price?: string;
  store?: string;
};

type SteamCliEnhancedApp = {
  price_insights?: {
    best_ever_deal?: SteamCliHistoricDeal;
    steam_store_low?: SteamCliHistoricDeal;
  };
};

type HistoricalLowMetadata = Pick<
  CalendarEvent,
  "historicalLowDate" | "historicalLowPrice" | "historicalLowStore"
>;

const MEDIA_CONCURRENCY = 3;
const MEDIA_IMAGE_PRIORITY = [
  "library_hero",
  "library_hero_2x",
  "hero_capsule",
  "hero_capsule_2x",
  "main_capsule",
  "main_capsule_2x",
  "page_background",
  "raw_page_background",
  "header",
  "header_2x",
  "capsule_616x353",
  "capsule_231x87",
  "capsule_231x87_2x",
  "library_600x900",
  "library_600x900_2x",
  "logo",
];

export async function fetchSteamDealEvents(
  options: SteamDealEventOptions = {},
): Promise<CalendarEvent[]> {
  const count = options.count ?? 5;
  const data = await runSteamCliJson<SteamDealItem[]>(
    ["deals", "--filter", "topsellers", "--any", "discounted,preorder", "--count", String(count)],
    {
      cacheTtlMs: STEAM_CLI_CACHE_TTL.deals,
      cc: options.cc,
      lang: options.lang,
      uiLang: options.uiLang,
    },
  );

  if (!data) {
    return [];
  }

  const deals = await enrichSteamDealMedia(data, options);
  const events = await mapWithConcurrency(deals, MEDIA_CONCURRENCY, async (deal) => {
    const [historyEvents, historicalLow] = await Promise.all([
      dealHistoryEvents(deal, options),
      fetchHistoricalLowMetadata(deal.appid, options),
    ]);
    const dealEvents = historyEvents.length
      ? preferActiveStoreDealPrices(historyEvents, {
          finalPrice: deal.final,
          originalPrice: deal.original,
        })
      : mapSteamDealEvents([deal], { today: options.today });

    return dealEvents.map((event) =>
      dropHistoricalLowWhenCurrencyMismatch({ ...event, ...historicalLow }, options.cc),
    );
  });

  return events.flat();
}

async function enrichSteamDealMedia(
  deals: SteamDealItem[],
  options: { cc?: string; lang?: string; uiLang?: string },
): Promise<SteamDealItem[]> {
  return mapWithConcurrency(deals, MEDIA_CONCURRENCY, async (deal) => {
    const media = await fetchSteamMedia(deal.appid, options);
    const imageUrl = media ? selectSteamMediaImage(media) : undefined;

    return imageUrl ? { ...deal, image_url: imageUrl } : deal;
  });
}

async function fetchSteamMedia(
  appId: number,
  options: { cc?: string; lang?: string; uiLang?: string },
): Promise<SteamMedia | null> {
  try {
    return await runSteamCliJson<SteamMedia>(["media", String(appId), "--probe"], {
      cacheTtlMs: STEAM_CLI_CACHE_TTL.media,
      cc: options.cc,
      lang: options.lang,
      processTimeoutMs: 20_000,
      uiLang: options.uiLang,
    });
  } catch {
    return null;
  }
}

async function dealHistoryEvents(
  deal: SteamDealItem,
  options: SteamDealEventOptions,
): Promise<CalendarEvent[]> {
  if (options.usePriceHistory === false || !deal.discount || !deal.discount_end) {
    return [];
  }

  return fetchSteamHistorySaleEvents(deal.appid, {
    ...options,
    activeDiscountEnd: deal.discount_end,
    days: options.historyDays,
    imageUrl: deal.image_url,
    name: deal.name,
    review: deal.review,
    sourceUrl: deal.url,
    useHistory: options.usePriceHistory,
  });
}

async function fetchHistoricalLowMetadata(
  appId: number,
  options: SteamDealEventOptions,
): Promise<HistoricalLowMetadata> {
  if (!hasAdvancedPricingKey() || options.usePriceHistory === false) {
    return {};
  }

  try {
    const app = await runSteamCliJson<SteamCliEnhancedApp>(["app", String(appId), "--enhanced"], {
      cacheTtlMs: STEAM_CLI_CACHE_TTL.watchedApp,
      cc: options.cc,
      lang: options.lang,
      processTimeoutMs: 30_000,
      uiLang: options.uiLang,
    });
    const historicalLow = readHistoricalLow(app?.price_insights);

    return historicalLow
      ? {
          historicalLowDate: historicalLow.date,
          historicalLowPrice: historicalLow.price,
          ...(historicalLow.store ? { historicalLowStore: historicalLow.store } : {}),
        }
      : {};
  } catch (error) {
    console.warn(
      [
        "[steam-deal]",
        "status=fallback",
        "reason=historical_low_query_failed",
        `appId=${appId}`,
        errorLogPart(error),
      ]
        .filter(Boolean)
        .join(" "),
    );
    return {};
  }
}

function readHistoricalLow(
  priceInsights: SteamCliEnhancedApp["price_insights"],
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

export function selectSteamMediaImage(media: SteamMedia): string | undefined {
  const eligibleAssets = (media.cdn_assets ?? [])
    .filter((asset) => asset.url && isSteamMediaAssetAvailable(asset))
    .map((asset) => ({ ...asset, url: normalizeSteamImageUrl(asset.url) }))
    .filter((asset) => asset.url);
  const assetsByName = new Map(eligibleAssets.map((asset) => [asset.name, asset.url]));

  for (const assetName of MEDIA_IMAGE_PRIORITY) {
    const url = assetsByName.get(assetName);

    if (url) {
      return url;
    }
  }

  const broadFallback =
    eligibleAssets.find((asset) => asset.kind === "capsule" || asset.kind === "header") ??
    eligibleAssets.find((asset) => asset.kind === "library" || asset.kind === "background") ??
    eligibleAssets[0];

  return broadFallback?.url ?? normalizeSteamImageUrl(media.header_image);
}

function isSteamMediaAssetAvailable(asset: SteamMediaAsset): boolean {
  if (asset.available === false) {
    return false;
  }

  if (typeof asset.status === "number" && (asset.status < 200 || asset.status >= 400)) {
    return false;
  }

  return true;
}

function normalizeSteamImageUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
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
