import type { SteamAppDetails } from '@/lib/steam/client';

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  sourceUrl?: string;
  type: 'wishlist_release' | 'steam_major_event';
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
        description: [`Steam app ${app.appId}`, app.storeUrl].join('\n'),
        startDate,
        sourceUrl: app.storeUrl,
        type: 'wishlist_release' as const,
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
