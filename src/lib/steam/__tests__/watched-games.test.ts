import { describe, expect, it } from 'vitest';
import { mapSteamCliAppToWatchedEvents } from '../watched-games';

describe('watched Steam games', () => {
  it('maps a selected discounted game to a calendar deal event', () => {
    const events = mapSteamCliAppToWatchedEvents({
      appid: 264710,
      details: {
        developers: ['Unknown Worlds Entertainment'],
        genres: [{ description: 'Adventure' }],
        header_image: 'https://cdn.example.test/header.jpg',
        name: 'Subnautica',
        publishers: ['KRAFTON, Inc.'],
        short_description: 'Descend into the depths of an alien underwater world.',
      },
      reviews: {
        review_score_desc: 'Overwhelmingly Positive',
        total_positive: 272640,
        total_negative: 11360,
        total_reviews: 284000,
      },
      store_item: {
        best_purchase_option: {
          discount_pct: 75,
          formatted_final_price: '$7.49',
          formatted_original_price: '$29.99',
          active_discounts: [{ discount_end_date: 1779728400 }],
        },
        reviews: {
          summary_filtered: {
            percent_positive: 96,
            review_count: 284000,
            review_score_label: 'Overwhelmingly Positive',
          },
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
        genres: ['Adventure'],
        reviewSummary: 'Overwhelmingly Positive',
        reviewPercentage: 96,
        reviewCount: 284000,
        developers: ['Unknown Worlds Entertainment'],
        publishers: ['KRAFTON, Inc.'],
      }),
    ]);
    expect(events[0].description).toContain('Descend into the depths of an alien underwater world.');
    expect(events[0].description).not.toContain('watched Steam games');
    expect(events[0].description).not.toContain('Deal shown');
  });

  it('maps an unreleased selected game to a release event', () => {
    const events = mapSteamCliAppToWatchedEvents({
      appid: 1962700,
      details: {
        genres: [{ description: 'Adventure' }, { description: 'Multiplayer' }],
        name: 'Subnautica 2',
        short_description: 'Return to Planet 4546B with friends.',
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
        genres: ['Adventure', 'Multiplayer'],
        releaseDateText: '2026',
      }),
    ]);
    expect(events[0].description).toContain('Return to Planet 4546B with friends.');
    expect(events[0].description).not.toContain('watched Steam games');
  });
});
