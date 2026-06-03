import type { SteamEventCategory } from "@/domain/calendar/config";
import {
  steamStoreDiscountEndExclusiveIsoDate,
  steamStoreLocalIsoDate,
  steamStoreTimeZone,
} from "@/shared/steam-timezones";

export type CalendarEventDataSource = "steam_history" | "steam_store" | "steam_events";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  sourceUrl?: string;
  type: "wishlist_release" | "steam_major_event" | "steam_deal" | "steam_preorder";
  dataSource?: CalendarEventDataSource;
  appId?: string;
  imageUrl?: string;
  eventCategory?: SteamEventCategory;
  discount?: string;
  originalPrice?: string;
  finalPrice?: string;
  releaseTime?: number;
  discountEnd?: number;
  discountStart?: number;
  historicalLowDate?: string;
  historicalLowPrice?: string;
  historicalLowStore?: string;
  saleStatus?: string;
  saleStore?: string;
  genres?: string[];
  reviewSummary?: string;
  reviewPercentage?: number;
  reviewCount?: number;
  developers?: string[];
  publishers?: string[];
  releaseDateText?: string | null;
};

export type SteamDealItem = {
  appid: number;
  name: string;
  release_time?: number;
  review?: string;
  discount?: string;
  original?: string;
  final?: string;
  discount_end?: number;
  image_url?: string;
  url?: string;
};

export type SteamHistorySale = {
  start: string;
  start_at?: string;
  start_unix?: number;
  end?: string;
  end_at?: string;
  end_unix?: number;
  store: string;
  price: string;
  original: string;
  discount: string;
  status: string;
  duration_days?: number;
};

export type SteamMajorEventSeed = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  description?: string;
  sourceUrl?: string;
};

export type WishlistReleaseEventInput = {
  appId: string;
  developers?: string[];
  genres?: string[];
  hasExactReleaseDate: boolean;
  name: string;
  publishers?: string[];
  releaseDateText?: string | null;
  shortDescription?: string;
  storeUrl: string;
};

export type EventMapperOptions = {
  storeRegion?: string;
  today?: string;
};

export const STEAM_MAJOR_EVENTS_2026: SteamMajorEventSeed[] = [
  {
    id: "steam-summer-sale-2026",
    title: "Steam Summer Sale",
    startDate: "2026-06-25",
    endDate: "2026-07-10",
    description: "Major Steam seasonal sale.",
    sourceUrl: "https://store.steampowered.com/",
  },
  {
    id: "steam-next-fest-june-2026",
    title: "Steam Next Fest",
    startDate: "2026-06-08",
    endDate: "2026-06-16",
    description: "Steam demo festival for upcoming games.",
    sourceUrl: "https://store.steampowered.com/",
  },
];

export function mapWishlistReleaseEvents(
  apps: WishlistReleaseEventInput[],
  options: EventMapperOptions = {},
): CalendarEvent[] {
  const today = options.today ?? todayIsoDate();

  return apps.flatMap((app) => {
    // Steam often returns fuzzy release copy such as "Coming soon"; only exact dates can become
    // reliable calendar events.
    if (!app.hasExactReleaseDate || !app.releaseDateText) {
      return [];
    }

    const startDate = parseExactSteamReleaseDate(app.releaseDateText);
    if (!startDate) {
      return [];
    }

    if (startDate < today) {
      return [];
    }

    return [
      {
        id: `steam-app-${app.appId}-release`,
        title: `🎮 ${app.name} releases`,
        description: [app.shortDescription, app.storeUrl]
          .filter((part): part is string => Boolean(part))
          .join("\n"),
        startDate,
        sourceUrl: app.storeUrl,
        type: "wishlist_release" as const,
        dataSource: "steam_store",
        appId: app.appId,
        ...(app.genres?.length ? { genres: app.genres } : {}),
        ...(app.developers?.length ? { developers: app.developers } : {}),
        ...(app.publishers?.length ? { publishers: app.publishers } : {}),
        ...(app.releaseDateText ? { releaseDateText: app.releaseDateText } : {}),
      },
    ];
  });
}

export function mapSteamMajorEvents(
  seeds: SteamMajorEventSeed[] = STEAM_MAJOR_EVENTS_2026,
  options: EventMapperOptions = {},
): CalendarEvent[] {
  const today = options.today ?? todayIsoDate();

  return seeds
    .filter((seed) => seed.endDate >= today)
    .map((seed) => ({
      id: seed.id,
      title: `🎮 ${seed.title}`,
      description: seed.description ?? seed.title,
      startDate: seed.startDate,
      endDate: seed.endDate,
      sourceUrl: seed.sourceUrl,
      type: "steam_major_event",
      dataSource: "steam_events",
    }));
}

export function mapSteamDealEvents(
  deals: SteamDealItem[],
  options: EventMapperOptions = {},
): CalendarEvent[] {
  const today = options.today ?? todayIsoDate();
  const timeZone = options.storeRegion ? steamStoreTimeZone(options.storeRegion) : null;

  return deals.flatMap((deal): CalendarEvent[] => {
    const appId = String(deal.appid);
    const sourceUrl = deal.url || steamStoreUrl(appId);
    const discount = cleanDealValue(deal.discount);
    const finalPrice = cleanDealValue(deal.final);
    const originalPrice = cleanDealValue(deal.original);
    const imageUrl = cleanDealValue(deal.image_url);

    if (discount && deal.discount_end) {
      const endDate = timeZone
        ? steamStoreDiscountEndExclusiveIsoDate(deal.discount_end, timeZone, addDays)
        : unixSecondsToIsoDate(deal.discount_end);

      // Active deals start "today" in the calendar and end when Steam says the discount ends.
      return [
        {
          id: `steam-app-${appId}-deal`,
          title: `${discount} ${deal.name}`,
          description: [
            cleanDealValue(deal.review),
            finalPrice && originalPrice ? `Price: ${finalPrice} (was ${originalPrice})` : null,
            sourceUrl,
          ]
            .filter((part): part is string => Boolean(part))
            .join("\n"),
          startDate: today,
          endDate: endDate <= today ? addDays(today, 1) : endDate,
          sourceUrl,
          type: "steam_deal" as const,
          dataSource: "steam_store",
          appId,
          discount,
          originalPrice,
          finalPrice,
          ...(imageUrl ? { imageUrl } : {}),
          discountEnd: deal.discount_end,
        },
      ];
    }

    if (deal.release_time) {
      const releaseDate = unixSecondsToIsoDate(deal.release_time);
      if (releaseDate < today) {
        return [];
      }

      return [
        {
          id: `steam-app-${appId}-preorder`,
          title: `${deal.name} preorder`,
          description: [
            cleanDealValue(deal.review),
            finalPrice ? `Price: ${finalPrice}` : null,
            `Release date: ${releaseDate}`,
            sourceUrl,
          ]
            .filter((part): part is string => Boolean(part))
            .join("\n"),
          startDate: releaseDate,
          sourceUrl,
          type: "steam_preorder" as const,
          dataSource: "steam_store",
          appId,
          finalPrice,
          ...(imageUrl ? { imageUrl } : {}),
          releaseTime: deal.release_time,
        },
      ];
    }

    return [];
  });
}

export function mapSteamHistorySaleEvents(
  input: {
    appId: string | number;
    name: string;
    sales: SteamHistorySale[];
    sourceUrl?: string;
    imageUrl?: string;
    review?: string;
    activeDiscountEnd?: number;
  },
  options: EventMapperOptions = {},
): CalendarEvent[] {
  const appId = String(input.appId);
  const timeZone = options.storeRegion ? steamStoreTimeZone(options.storeRegion) : null;
  const sourceUrl = input.sourceUrl || steamStoreUrl(appId);
  const imageUrl = cleanDealValue(input.imageUrl);
  const review = cleanDealValue(input.review);

  return input.sales.flatMap((sale, index): CalendarEvent[] => {
    const startDate =
      sale.start_unix && timeZone ? steamStoreLocalIsoDate(sale.start_unix, timeZone) : sale.start;

    if (!isIsoDate(startDate)) {
      return [];
    }

    const discount = cleanDealValue(sale.discount);
    if (!discount || discount === "0%") {
      return [];
    }

    const inferredEndDate =
      sale.end_unix && timeZone
        ? steamStoreDiscountEndExclusiveIsoDate(sale.end_unix, timeZone, addDays)
        : sale.end && isIsoDate(sale.end)
          ? sale.end
          : input.activeDiscountEnd
            ? timeZone
              ? steamStoreDiscountEndExclusiveIsoDate(input.activeDiscountEnd, timeZone, addDays)
              : unixSecondsToIsoDate(input.activeDiscountEnd)
            : undefined;
    // Some stores report same-day or missing sale ends; give calendar apps a visible one-day
    // event instead of a zero-length span.
    const endDate =
      inferredEndDate && inferredEndDate <= startDate ? addDays(startDate, 1) : inferredEndDate;
    const isActive =
      isActiveSteamSaleStatus(sale.status) || Boolean(input.activeDiscountEnd && !sale.end);
    const originalPrice = cleanDealValue(sale.original);
    const finalPrice = cleanDealValue(sale.price);

    return [
      {
        id: `steam-app-${appId}-${isActive ? "active" : "history"}-deal-${startDate}-${index}`,
        title: `${discount} ${input.name}`,
        description: historySaleDescription({
          review,
          finalPrice,
          originalPrice,
          sale,
          sourceUrl,
        }),
        startDate,
        ...(endDate ? { endDate } : {}),
        sourceUrl,
        type: "steam_deal",
        dataSource: "steam_history",
        appId,
        discount,
        originalPrice,
        finalPrice,
        ...(imageUrl ? { imageUrl } : {}),
        ...(sale.start_unix ? { discountStart: sale.start_unix } : {}),
        ...(sale.end_unix || input.activeDiscountEnd
          ? { discountEnd: sale.end_unix ?? input.activeDiscountEnd }
          : {}),
        saleStatus: sale.status,
        saleStore: sale.store,
      },
    ];
  });
}

export function preferActiveStoreDealPrices(
  events: CalendarEvent[],
  prices: { finalPrice?: string; originalPrice?: string },
): CalendarEvent[] {
  const finalPrice = cleanDealValue(prices.finalPrice);
  const originalPrice = cleanDealValue(prices.originalPrice);

  if (!finalPrice && !originalPrice) {
    return events;
  }

  return events.map((event) => {
    if (
      event.type !== "steam_deal" ||
      event.dataSource !== "steam_history" ||
      !isActiveSteamSaleStatus(event.saleStatus)
    ) {
      return event;
    }

    return {
      ...event,
      ...(finalPrice ? { finalPrice } : {}),
      ...(originalPrice ? { originalPrice } : {}),
      description: replacePriceDescriptionLine(event.description, finalPrice, originalPrice),
    };
  });
}

export function dropHistoricalLowWhenCurrencyMismatch<T extends Partial<CalendarEvent>>(
  event: T,
  regionCode?: string,
): T {
  if (!event.historicalLowPrice) {
    return event;
  }

  const historicalCurrency = inferCurrencyCode(event.historicalLowPrice, regionCode);
  const currentCurrency =
    inferCurrencyCode(event.finalPrice, regionCode) ??
    inferCurrencyCode(event.originalPrice, regionCode);

  if (!historicalCurrency || !currentCurrency || historicalCurrency === currentCurrency) {
    return event;
  }

  const eventWithoutHistoricalLow = { ...event };
  delete eventWithoutHistoricalLow.historicalLowDate;
  delete eventWithoutHistoricalLow.historicalLowPrice;
  delete eventWithoutHistoricalLow.historicalLowStore;

  return eventWithoutHistoricalLow as T;
}

export function parseExactSteamReleaseDate(releaseDateText: string): string | null {
  // Domain code stores dates as YYYY-MM-DD strings to avoid timezone shifts in all-day events.
  const match = releaseDateText.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);
  if (!match) {
    return null;
  }

  const month = monthNumber(match[1]);
  if (!month) {
    return null;
  }

  const day = match[2].padStart(2, "0");
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function monthNumber(month: string): string | null {
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  return months[month] ?? null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function cleanDealValue(value?: string): string | undefined {
  if (!value || value.trim() === "-") {
    return undefined;
  }

  return value.trim();
}

function historySaleDescription(input: {
  review?: string;
  finalPrice?: string;
  originalPrice?: string;
  sale: SteamHistorySale;
  sourceUrl: string;
}): string {
  return [
    input.review,
    input.finalPrice && input.originalPrice
      ? `Price: ${input.finalPrice} (was ${input.originalPrice})`
      : null,
    input.sale.store ? `Store: ${input.sale.store}` : null,
    input.sale.status ? `Status: ${input.sale.status}` : null,
    input.sourceUrl,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

function replacePriceDescriptionLine(
  description: string,
  finalPrice: string | undefined,
  originalPrice: string | undefined,
): string {
  const priceLine =
    finalPrice && originalPrice
      ? `Price: ${finalPrice} (was ${originalPrice})`
      : finalPrice
        ? `Price: ${finalPrice}`
        : originalPrice
          ? `Original price: ${originalPrice}`
          : null;

  if (!priceLine) {
    return description;
  }

  const lines = description.split("\n");
  const priceLineIndex = lines.findIndex((line) => line.startsWith("Price: "));

  if (priceLineIndex >= 0) {
    lines[priceLineIndex] = priceLine;
    return lines.join("\n");
  }

  const sourceUrlIndex = lines.findIndex((line) => line.startsWith("https://"));
  if (sourceUrlIndex >= 0) {
    lines.splice(sourceUrlIndex, 0, priceLine);
    return lines.join("\n");
  }

  return [...lines, priceLine].join("\n");
}

function isActiveSteamSaleStatus(value: string | undefined): boolean {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return ["active", "ongoing", "live", "进行中"].includes(normalizedValue);
}

const CURRENCY_CODE_BY_REGION: Record<string, string> = {
  AE: "AED",
  AU: "AUD",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CL: "CLP",
  CN: "CNY",
  CO: "COP",
  GB: "GBP",
  HK: "HKD",
  ID: "IDR",
  IN: "INR",
  JP: "JPY",
  KR: "KRW",
  MX: "MXN",
  MY: "MYR",
  NO: "NOK",
  NZ: "NZD",
  PE: "PEN",
  PH: "PHP",
  PL: "PLN",
  SA: "SAR",
  SG: "SGD",
  TH: "THB",
  TW: "TWD",
  UA: "UAH",
  US: "USD",
  VN: "VND",
  ZA: "ZAR",
};

const REGION_PRICE_MARKERS: Record<string, string[]> = {
  AE: ["AED"],
  CH: ["CHF"],
  CL: ["CLP$"],
  CO: ["COL$"],
  HK: ["HK$"],
  MX: ["Mex$", "MX$"],
  MY: ["RM"],
  NO: ["kr"],
  PE: ["S/."],
  SA: ["SR"],
  SG: ["S$"],
  TH: ["฿"],
  UA: ["₴"],
  VN: ["₫"],
  ZA: ["R "],
};

function inferCurrencyCode(value: string | undefined, regionCode?: string): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const explicitCode = trimmed.match(/\b[A-Z]{3}\b/)?.[0];

  if (explicitCode) {
    return explicitCode;
  }

  const normalizedRegionCode = regionCode?.toUpperCase();
  const regionCurrency = normalizedRegionCode
    ? CURRENCY_CODE_BY_REGION[normalizedRegionCode]
    : undefined;
  const markers = normalizedRegionCode ? (REGION_PRICE_MARKERS[normalizedRegionCode] ?? []) : [];

  if (regionCurrency && markers.some((marker) => trimmed.includes(marker))) {
    return regionCurrency;
  }

  return null;
}

function steamStoreUrl(appId: string): string {
  return `https://store.steampowered.com/app/${appId}/`;
}

function unixSecondsToIsoDate(value: number): string {
  return new Date(value * 1000).toISOString().slice(0, 10);
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
