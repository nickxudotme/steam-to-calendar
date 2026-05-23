import { mapSteamMajorEvents } from '@/lib/events/mapper';
import type { CalendarEvent } from '@/lib/events/mapper';
import { runSteamCliJson } from '@/lib/steam/cli';

type SteamCliEvent = {
  name: string;
  start_date: string;
  end_date: string;
  status?: string;
  category?: string;
  timezone?: string;
  description?: string;
  notes?: string;
  registration_url?: string;
  info_url?: string;
};

export async function fetchSteamMajorEvents(): Promise<CalendarEvent[]> {
  const data = await runSteamCliJson<SteamCliEvent[]>([
    'events',
    '--past-days',
    '0',
    '--future-days',
    '365',
  ]);

  if (!data) {
    return mapSteamMajorEvents();
  }

  return mapSteamCliEvents(data);
}

export function mapSteamCliEvents(events: SteamCliEvent[]): CalendarEvent[] {
  return events
    .filter((event) => isIsoDate(event.start_date) && isIsoDate(event.end_date))
    .map((event) => ({
      id: `steam-event-${event.start_date}-${slug(event.name)}`,
      title: `${eventIcon(event)} ${event.name}`,
      description: eventDescription(event),
      startDate: event.start_date,
      endDate: event.end_date,
      sourceUrl: event.info_url ?? event.registration_url ?? 'https://store.steampowered.com/',
      type: 'steam_major_event' as const,
    }));
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
