import { describe, expect, it } from 'vitest';
import {
  mapSteamDealEvents,
  mapSteamMajorEvents,
  mapWishlistReleaseEvents,
  parseExactSteamReleaseDate,
} from '../mapper';
import type { SteamAppDetails } from '@/lib/steam/client';

describe('event mapper', () => {
  it('parses exact Steam release dates into ISO dates', () => {
    expect(parseExactSteamReleaseDate('May 14, 2026')).toBe('2026-05-14');
    expect(parseExactSteamReleaseDate('Jan 3, 2018')).toBe('2018-01-03');
  });

  it('rejects non-exact release dates', () => {
    expect(parseExactSteamReleaseDate('May 2026')).toBeNull();
    expect(parseExactSteamReleaseDate('Coming soon')).toBeNull();
    expect(parseExactSteamReleaseDate('2026')).toBeNull();
  });

  it('maps exact wishlist release dates to calendar events', () => {
    const apps: SteamAppDetails[] = [
      {
        appId: '1962700',
        name: 'Subnautica 2',
        releaseDateText: 'May 14, 2026',
        hasExactReleaseDate: true,
        storeUrl: 'https://store.steampowered.com/app/1962700/',
      },
    ];

    expect(mapWishlistReleaseEvents(apps, { today: '2026-05-01' })).toEqual([
      {
        id: 'steam-app-1962700-release',
        title: '🎮 Subnautica 2 releases',
        description: 'Steam app 1962700\nhttps://store.steampowered.com/app/1962700/',
        startDate: '2026-05-14',
        sourceUrl: 'https://store.steampowered.com/app/1962700/',
        type: 'wishlist_release',
      },
    ]);
  });

  it('excludes wishlist apps without exact release dates', () => {
    const apps: SteamAppDetails[] = [
      {
        appId: '1',
        name: 'Coming Soon Game',
        releaseDateText: 'Coming soon',
        hasExactReleaseDate: false,
        storeUrl: 'https://store.steampowered.com/app/1/',
      },
      {
        appId: '2',
        name: 'Month Only Game',
        releaseDateText: 'May 2026',
        hasExactReleaseDate: false,
        storeUrl: 'https://store.steampowered.com/app/2/',
      },
    ];

    expect(mapWishlistReleaseEvents(apps)).toEqual([]);
  });

  it('excludes exact wishlist release dates that are already in the past', () => {
    const apps: SteamAppDetails[] = [
      {
        appId: '264710',
        name: 'Subnautica',
        releaseDateText: 'Jan 23, 2018',
        hasExactReleaseDate: true,
        storeUrl: 'https://store.steampowered.com/app/264710/',
      },
    ];

    expect(mapWishlistReleaseEvents(apps, { today: '2026-05-20' })).toEqual([]);
  });

  it('maps Steam major events to calendar event ranges', () => {
    expect(
      mapSteamMajorEvents(
        [
          {
            id: 'steam-summer-sale-2026',
            title: 'Steam Summer Sale',
            startDate: '2026-06-25',
            endDate: '2026-07-10',
            description: 'Major sale.',
            sourceUrl: 'https://store.steampowered.com/',
          },
          {
            id: 'steam-next-fest-june-2026',
            title: 'Steam Next Fest',
            startDate: '2026-06-08',
            endDate: '2026-06-16',
          },
        ],
        { today: '2026-05-20' },
      ),
    ).toEqual([
      {
        id: 'steam-summer-sale-2026',
        title: '🎮 Steam Summer Sale',
        description: 'Major sale.',
        startDate: '2026-06-25',
        endDate: '2026-07-10',
        sourceUrl: 'https://store.steampowered.com/',
        type: 'steam_major_event',
      },
      {
        id: 'steam-next-fest-june-2026',
        title: '🎮 Steam Next Fest',
        description: 'Steam Next Fest',
        startDate: '2026-06-08',
        endDate: '2026-06-16',
        sourceUrl: undefined,
        type: 'steam_major_event',
      },
    ]);
  });

  it('excludes Steam major events that have already ended', () => {
    expect(
      mapSteamMajorEvents(
        [
          {
            id: 'steam-ended-sale-2026',
            title: 'Steam Ended Sale',
            startDate: '2026-01-01',
            endDate: '2026-01-08',
          },
        ],
        { today: '2026-05-20' },
      ),
    ).toEqual([]);
  });

  it('maps Steam deal media image URLs onto discount events', () => {
    expect(
      mapSteamDealEvents(
        [
          {
            appid: 3472040,
            name: 'NBA 2K26',
            discount: '-86%',
            original: '$69.99',
            final: '$9.79',
            discount_end: Math.floor(Date.parse('2026-06-01T00:00:00.000Z') / 1000),
            image_url: 'https://cdn.example.test/library_hero.jpg',
            url: 'https://store.steampowered.com/app/3472040/NBA_2K26/',
          },
        ],
        { today: '2026-05-25' },
      ),
    ).toEqual([
      {
        id: 'steam-app-3472040-deal',
        title: '-86% NBA 2K26',
        description: [
          'NBA 2K26 is currently discounted on Steam.',
          'Price: $9.79 (was $69.99)',
          'Deal shown from now until Steam reports it ends.',
          'https://store.steampowered.com/app/3472040/NBA_2K26/',
        ].join('\n'),
        startDate: '2026-05-25',
        endDate: '2026-06-01',
        sourceUrl: 'https://store.steampowered.com/app/3472040/NBA_2K26/',
        type: 'steam_deal',
        appId: '3472040',
        discount: '-86%',
        originalPrice: '$69.99',
        finalPrice: '$9.79',
        imageUrl: 'https://cdn.example.test/library_hero.jpg',
        discountEnd: Math.floor(Date.parse('2026-06-01T00:00:00.000Z') / 1000),
      },
    ]);
  });
});
