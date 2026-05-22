import { describe, expect, it } from 'vitest';
import { mapSteamCliEvents } from '../events';

describe('steam-cli event mapper', () => {
  it('maps official Steam event JSON into calendar events', () => {
    const events = mapSteamCliEvents([
      {
        name: 'Steam Next Fest',
        start_date: '2026-06-15',
        end_date: '2026-06-22',
        status: 'upcoming',
        category: 'next_fest',
        timezone: 'PT',
        description: 'Try demos and meet developers.',
        info_url: 'https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/2026june',
      },
      {
        name: 'bad event',
        start_date: 'June 2026',
        end_date: '2026-06-22',
      },
    ]);

    expect(events).toEqual([
      {
        id: 'steam-event-2026-06-15-steam-next-fest',
        title: '🧪 Steam Next Fest',
        description: [
          'Try demos and meet developers.',
          'Timezone: PT',
          'Status: upcoming',
          'https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/2026june',
        ].join('\n'),
        startDate: '2026-06-15',
        endDate: '2026-06-22',
        sourceUrl: 'https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/2026june',
        type: 'steam_major_event',
      },
    ]);
  });
});
