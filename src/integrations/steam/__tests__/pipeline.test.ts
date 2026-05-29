import { describe, expect, it } from "vitest";
import { fetchWishlistCalendarData, mapSteamCliWishlist } from "../pipeline";

const steamId64 = "76561198115468824";

function response(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

describe("Steam wishlist pipeline", () => {
  it("fetches wishlist and app details with an app limit", async () => {
    const calls: string[] = [];
    const result = await fetchWishlistCalendarData(steamId64, {
      appLimit: 2,
      concurrency: 1,
      fetcher: async (url) => {
        calls.push(url);

        if (url.includes("IWishlistService/GetWishlist")) {
          return response({
            response: {
              items: [{ appid: 1 }, { appid: 2 }, { appid: 3 }],
            },
          });
        }

        if (url.includes("steamcommunity.com")) {
          return response(
            `<profile><steamID64>${steamId64}</steamID64><steamID>Nick Xu</steamID></profile>`,
          );
        }

        const appId = new URL(url).searchParams.get("appids") ?? "unknown";
        return response({
          [appId]: {
            success: true,
            data: {
              header_image: `https://cdn.example.test/${appId}.jpg`,
              name: `App ${appId}`,
              release_date: { coming_soon: false, date: "May 14, 2026" },
            },
          },
        });
      },
    });

    expect(result.wishlistGames.map((game) => game.appId)).toEqual(["1", "2"]);
    expect(result.wishlistGames.map((game) => game.imageUrl)).toEqual([
      "https://cdn.example.test/1.jpg",
      "https://cdn.example.test/2.jpg",
    ]);
    expect(result.appDetails.map((app) => app.appId)).toEqual(["1", "2"]);
    expect(result.profileName).toBe("Nick Xu");
    expect(result.skippedAppIds).toEqual([]);
    expect(calls).toHaveLength(4);
  });

  it("keeps partial app details when one metadata fetch fails", async () => {
    const result = await fetchWishlistCalendarData(steamId64, {
      appLimit: 2,
      concurrency: 2,
      fetcher: async (url) => {
        if (url.includes("IWishlistService/GetWishlist")) {
          return response({
            response: {
              items: [{ appid: 1 }, { appid: 2 }],
            },
          });
        }

        const appId = new URL(url).searchParams.get("appids") ?? "unknown";
        if (appId === "2") {
          return response({ [appId]: { success: false } });
        }

        return response({
          [appId]: {
            success: true,
            data: {
              name: `App ${appId}`,
              release_date: { coming_soon: false, date: "May 14, 2026" },
            },
          },
        });
      },
    });

    expect(result.appDetails.map((app) => app.appId)).toEqual(["1"]);
    expect(result.skippedAppIds).toEqual(["2"]);
  });

  it("maps steam-cli wishlist JSON into calendar pipeline data", () => {
    const result = mapSteamCliWishlist({
      steamid64: steamId64,
      total: 2,
      offset: 0,
      count: 2,
      items: [
        {
          appid: 1962700,
          details: {
            header_image: "https://cdn.example.test/subnautica-2.jpg",
            name: "Subnautica 2",
            steam_appid: 1962700,
            release_date: { coming_soon: false, date: "May 14, 2026" },
          },
        },
        {
          appid: 123,
          error: "details unavailable",
        },
      ],
    });

    expect(result.wishlistGames).toHaveLength(2);
    expect(result.wishlistGames[0]?.imageUrl).toBe("https://cdn.example.test/subnautica-2.jpg");
    expect(result.appDetails).toEqual([
      {
        appId: "1962700",
        name: "Subnautica 2",
        imageUrl: "https://cdn.example.test/subnautica-2.jpg",
        releaseDateText: "May 14, 2026",
        hasExactReleaseDate: true,
        storeUrl: "https://store.steampowered.com/app/1962700/",
      },
    ]);
    expect(result.skippedAppIds).toEqual(["123"]);
  });
});
