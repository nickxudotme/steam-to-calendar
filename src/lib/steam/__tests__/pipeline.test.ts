import { describe, expect, it } from 'vitest';
import { fetchWishlistCalendarData, mapSteamCliWishlist } from '../pipeline';

const steamId64 = '76561198115468824';

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

        if (url.includes('IWishlistService/GetWishlist')) {
          return response({
            response: {
              items: [{ appid: 1 }, { appid: 2 }, { appid: 3 }],
            },
          });
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
        if (url.includes('IWishlistService/GetWishlist')) {
          return response({
            response: {
              items: [{ appid: 1 }, { appid: 2 }],
            },
          });
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

  it('maps steam-cli wishlist JSON into calendar pipeline data', () => {
    const result = mapSteamCliWishlist({
      steamid64: steamId64,
      total: 2,
      offset: 0,
      count: 2,
      items: [
        {
          appid: 1962700,
          details: {
            name: 'Subnautica 2',
            steam_appid: 1962700,
            release_date: { coming_soon: false, date: 'May 14, 2026' },
          },
        },
        {
          appid: 123,
          error: 'details unavailable',
        },
      ],
    });

    expect(result.wishlistGames).toHaveLength(2);
    expect(result.appDetails).toEqual([
      {
        appId: '1962700',
        name: 'Subnautica 2',
        releaseDateText: 'May 14, 2026',
        hasExactReleaseDate: true,
        storeUrl: 'https://store.steampowered.com/app/1962700/',
      },
    ]);
    expect(result.skippedAppIds).toEqual(['123']);
  });
});
