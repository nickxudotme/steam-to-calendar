import { describe, expect, it } from 'vitest';
import { mapSteamCliAppToWatchedEvents } from '../watched-games';

describe('watched Steam games', () => {
  it('maps a selected discounted game to a calendar deal event', () => {
    const events = mapSteamCliAppToWatchedEvents({
      appid: 264710,
      details: {
        header_image: 'https://cdn.example.test/header.jpg',
        name: 'Subnautica',
      },
      store_item: {
        best_purchase_option: {
          discount_pct: 75,
          formatted_final_price: '$7.49',
          formatted_original_price: '$29.99',
          active_discounts: [{ discount_end_date: 1779728400 }],
        },
      },
    }, { today: '2026-05-25' });

    expect(events).toEqual([
      expect.objectContaining({
        appId: '264710',
        discount: '-75%',
        finalPrice: '$7.49',
        id: 'steam-app-264710-watched-deal',
        imageUrl: 'https://cdn.example.test/header.jpg',
        startDate: '2026-05-25',
        title: '-75% Subnautica',
        type: 'steam_deal',
      }),
    ]);
  });

  it('maps an unreleased selected game to a release event', () => {
    const events = mapSteamCliAppToWatchedEvents({
      appid: 1962700,
      details: {
        name: 'Subnautica 2',
        release_date: { coming_soon: true, date: '2026' },
      },
      store_item: {
        release: {
          steam_release_date: 1798761600,
        },
      },
    }, { today: '2026-05-25' });

    expect(events).toEqual([
      expect.objectContaining({
        appId: '1962700',
        id: 'steam-app-1962700-watched-release',
        startDate: '2027-01-01',
        title: '🎮 Subnautica 2 releases',
        type: 'wishlist_release',
      }),
    ]);
  });
});
