import type { SteamEventCategory } from '@/lib/calendar-config';
import type { SteamAppDetails } from '@/lib/steam/client';

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  sourceUrl?: string;
  type: 'wishlist_release' | 'steam_major_event' | 'steam_deal' | 'steam_preorder';
  appId?: string;
  imageUrl?: string;
  eventCategory?: SteamEventCategory;
  discount?: string;
  originalPrice?: string;
  finalPrice?: string;
  releaseTime?: number;
  discountEnd?: number;
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

export type SteamMajorEventSeed = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  description?: string;
  sourceUrl?: string;
};

export type EventMapperOptions = {
  today?: string;
};

export const STEAM_MAJOR_EVENTS_2026: SteamMajorEventSeed[] = [
  {
    id: 'steam-summer-sale-2026',
    title: 'Steam Summer Sale',
    startDate: '2026-06-25',
    endDate: '2026-07-10',
    description: 'Major Steam seasonal sale.',
    sourceUrl: 'https://store.steampowered.com/',
  },
  {
    id: 'steam-next-fest-june-2026',
    title: 'Steam Next Fest',
    startDate: '2026-06-08',
    endDate: '2026-06-16',
    description: 'Steam demo festival for upcoming games.',
    sourceUrl: 'https://store.steampowered.com/',
  },
];

export function mapWishlistReleaseEvents(
  apps: SteamAppDetails[],
  options: EventMapperOptions = {},
): CalendarEvent[] {
  const today = options.today ?? todayIsoDate();

  return apps.flatMap((app) => {
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
        description: [app.shortDescription, app.storeUrl].filter((part): part is string => Boolean(part)).join('\n'),
        startDate,
        sourceUrl: app.storeUrl,
        type: 'wishlist_release' as const,
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
      type: 'steam_major_event',
    }));
}

export function mapSteamDealEvents(
  deals: SteamDealItem[],
  options: EventMapperOptions = {},
): CalendarEvent[] {
  const today = options.today ?? todayIsoDate();

  return deals.flatMap((deal): CalendarEvent[] => {
    const appId = String(deal.appid);
    const sourceUrl = deal.url || steamStoreUrl(appId);
    const discount = cleanDealValue(deal.discount);
    const finalPrice = cleanDealValue(deal.final);
    const originalPrice = cleanDealValue(deal.original);
    const imageUrl = cleanDealValue(deal.image_url);

    if (discount && deal.discount_end) {
      const endDate = unixSecondsToIsoDate(deal.discount_end);

      return [{
        id: `steam-app-${appId}-deal`,
        title: `${discount} ${deal.name}`,
        description: [
          cleanDealValue(deal.review),
          finalPrice && originalPrice ? `Price: ${finalPrice} (was ${originalPrice})` : null,
          sourceUrl,
        ].filter((part): part is string => Boolean(part)).join('\n'),
        startDate: today,
        endDate: endDate <= today ? addDays(today, 1) : endDate,
        sourceUrl,
        type: 'steam_deal' as const,
        appId,
        discount,
        originalPrice,
        finalPrice,
        ...(imageUrl ? { imageUrl } : {}),
        discountEnd: deal.discount_end,
      }];
    }

    if (deal.release_time) {
      const releaseDate = unixSecondsToIsoDate(deal.release_time);
      if (releaseDate < today) {
        return [];
      }

      return [{
        id: `steam-app-${appId}-preorder`,
        title: `${deal.name} preorder`,
        description: [
          cleanDealValue(deal.review),
          finalPrice ? `Price: ${finalPrice}` : null,
          `Release date: ${releaseDate}`,
          sourceUrl,
        ].filter((part): part is string => Boolean(part)).join('\n'),
        startDate: releaseDate,
        sourceUrl,
        type: 'steam_preorder' as const,
        appId,
        finalPrice,
        ...(imageUrl ? { imageUrl } : {}),
        releaseTime: deal.release_time,
      }];
    }

    return [];
  });
}

export function parseExactSteamReleaseDate(releaseDateText: string): string | null {
  const match = releaseDateText.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);
  if (!match) {
    return null;
  }

  const month = monthNumber(match[1]);
  if (!month) {
    return null;
  }

  const day = match[2].padStart(2, '0');
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function monthNumber(month: string): string | null {
  const months: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
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
  if (!value || value.trim() === '-') {
    return undefined;
  }

  return value.trim();
}

function steamStoreUrl(appId: string): string {
  return `https://store.steampowered.com/app/${appId}/`;
}

function unixSecondsToIsoDate(value: number): string {
  return new Date(value * 1000).toISOString().slice(0, 10);
}
