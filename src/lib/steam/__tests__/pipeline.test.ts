import { describe, expect, it } from 'vitest';
import { fetchWishlistCalendarData } from '../pipeline';

const steamId64 = '76561199022537892';

function response(body: unknown, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

describe('Steam wishlist pipeline', () => {
  it('fetches wishlist and app details with an app limit', async () => {
    const calls: string[] = [];
    const result = await fetchWishlistCalendarData(steamId64, {
      appLimit: 2,
      concurrency: 1,
      fetcher: async (url) => {
        calls.push(url);

        if (url.includes('/wishlist/')) {
          return response(
            'GStoreItemData.AddStoreItemDataSet({"rgApps":{"1":{"name":"One"},"2":{"name":"Two"},"3":{"name":"Three"}}});',
          );
        }

        const appId = new URL(url).searchParams.get('appids') ?? 'unknown';
        return response({
          [appId]: {
            success: true,
            data: {
              name: `App ${appId}`,
              release_date: { coming_soon: false, date: 'May 14, 2026' },
            },
          },
        });
      },
    });

    expect(result.wishlistGames.map((game) => game.appId)).toEqual(['1', '2']);
    expect(result.appDetails.map((app) => app.appId)).toEqual(['1', '2']);
    expect(result.skippedAppIds).toEqual([]);
    expect(calls).toHaveLength(3);
  });

  it('keeps partial app details when one metadata fetch fails', async () => {
    const result = await fetchWishlistCalendarData(steamId64, {
      appLimit: 2,
      concurrency: 2,
      fetcher: async (url) => {
        if (url.includes('/wishlist/')) {
          return response(
            'GStoreItemData.AddStoreItemDataSet({"rgApps":{"1":{"name":"One"},"2":{"name":"Two"}}});',
          );
        }

        const appId = new URL(url).searchParams.get('appids') ?? 'unknown';
        if (appId === '2') {
          return response({ [appId]: { success: false } });
        }

        return response({
          [appId]: {
            success: true,
            data: {
              name: `App ${appId}`,
              release_date: { coming_soon: false, date: 'May 14, 2026' },
            },
          },
        });
      },
    });

    expect(result.appDetails.map((app) => app.appId)).toEqual(['1']);
    expect(result.skippedAppIds).toEqual(['2']);
  });
});
