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
        name: 'Warhammer SKULLS 2026',
        start_date: '2026-05-21',
        end_date: '2026-05-28',
        status: 'active',
        category: 'store_sale',
        timezone: 'PT',
        description: 'Steam Store sale page.',
        info_url: 'https://store.steampowered.com/sale/skulls2026',
        image_url: 'https://cdn.example.test/skulls-capsule.jpg',
        background_image_url: 'https://cdn.example.test/skulls-background.jpg',
      },
      {
        name: 'Steam Demo Fest',
        start_date: '2026-07-01',
        end_date: '2026-07-08',
        category: 'fest',
        images: {
          hero: '//cdn.example.test/demo-fest-hero.jpg',
        },
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
        title: '🎮 Steam Next Fest',
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
        eventCategory: 'next_fest',
      },
      {
        id: 'steam-event-2026-05-21-warhammer-skulls-2026',
        title: '🎮 Warhammer SKULLS 2026',
        description: [
          'Steam Store sale page.',
          'Timezone: PT',
          'Status: active',
          'https://store.steampowered.com/sale/skulls2026',
        ].join('\n'),
        startDate: '2026-05-21',
        endDate: '2026-05-28',
        sourceUrl: 'https://store.steampowered.com/sale/skulls2026',
        type: 'steam_major_event',
        eventCategory: 'store_sale',
        imageUrl: 'https://cdn.example.test/skulls-background.jpg',
      },
      {
        id: 'steam-event-2026-07-01-steam-demo-fest',
        title: '🎮 Steam Demo Fest',
        description: 'Steam Demo Fest',
        startDate: '2026-07-01',
        endDate: '2026-07-08',
        sourceUrl: 'https://store.steampowered.com/',
        type: 'steam_major_event',
        eventCategory: 'fest',
        imageUrl: 'https://cdn.example.test/demo-fest-hero.jpg',
      },
    ]);
  });

  it('filters official Steam events by category', () => {
    const events = mapSteamCliEvents([
      {
        name: 'Steam Summer Sale',
        start_date: '2026-06-25',
        end_date: '2026-07-09',
        category: 'seasonal',
      },
      {
        name: 'Steam Next Fest',
        start_date: '2026-06-15',
        end_date: '2026-06-22',
        category: 'next_fest',
      },
    ], { categories: ['next_fest'] });

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('🎮 Steam Next Fest');
  });
});
