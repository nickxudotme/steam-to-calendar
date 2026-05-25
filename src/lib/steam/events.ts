import type { SteamEventCategory } from '@/lib/calendar-config';
import { mapSteamMajorEvents } from '@/lib/events/mapper';
import type { CalendarEvent } from '@/lib/events/mapper';
import { STEAM_CLI_CACHE_TTL } from '@/lib/steam/cache-policy';
import { runSteamCliJson } from '@/lib/steam/cli';

type SteamCliEvent = {
  name: string;
  start_date: string;
  end_date: string;
  status?: string;
  category?: SteamEventCategory | string;
  timezone?: string;
  description?: string;
  notes?: string;
  registration_url?: string;
  info_url?: string;
  image_url?: string;
  background_image_url?: string;
};

export async function fetchSteamMajorEvents(
  options: {
    categories?: SteamEventCategory[];
    cc?: string;
    futureDays?: number;
    lang?: string;
    pastDays?: number;
    uiLang?: string;
  } = {},
): Promise<CalendarEvent[]> {
  const pastDays = options.pastDays ?? 0;
  const futureDays = options.futureDays ?? 365;
  const data = await runSteamCliJson<SteamCliEvent[]>([
    'events',
    '--past-days',
    String(pastDays),
    '--future-days',
    String(futureDays),
  ], {
    cacheTtlMs: STEAM_CLI_CACHE_TTL.events,
    cc: options.cc,
    lang: options.lang,
    uiLang: options.uiLang,
  });

  if (!data) {
    return mapSteamMajorEvents();
  }

  return mapSteamCliEvents(data, { categories: options.categories });
}

export function mapSteamCliEvents(
  events: SteamCliEvent[],
  options: { categories?: SteamEventCategory[] } = {},
): CalendarEvent[] {
  const categories = options.categories ? new Set(options.categories) : null;

  return events
    .filter((event) => isIsoDate(event.start_date) && isIsoDate(event.end_date))
    .filter((event) => !categories || (isSteamEventCategory(event.category) && categories.has(event.category)))
    .map((event) => ({
      id: `steam-event-${event.start_date}-${slug(event.name)}`,
      title: `${eventIcon(event)} ${event.name}`,
      description: eventDescription(event),
      startDate: event.start_date,
      endDate: event.end_date,
      sourceUrl: event.info_url ?? event.registration_url ?? 'https://store.steampowered.com/',
      type: 'steam_major_event' as const,
      ...(isSteamEventCategory(event.category) ? { eventCategory: event.category } : {}),
      ...(event.background_image_url || event.image_url ? { imageUrl: event.background_image_url ?? event.image_url } : {}),
    }));
}

function isSteamEventCategory(value: string | undefined): value is SteamEventCategory {
  return value === 'seasonal' || value === 'next_fest' || value === 'fest' || value === 'store_sale';
}

function eventIcon(event: SteamCliEvent): string {
  return '🎮';
}

function eventDescription(event: SteamCliEvent): string {
  return [
    event.description || event.notes || event.name,
    event.timezone ? `Timezone: ${event.timezone}` : null,
    event.status ? `Status: ${event.status}` : null,
    event.info_url,
  ].filter((part): part is string => Boolean(part)).join('\n');
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function slug(value: string): string {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return ascii || encodeURIComponent(value).replace(/%/g, '').toLowerCase();
}
