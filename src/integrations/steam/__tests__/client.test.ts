import { describe, expect, it } from "vitest";
import {
  buildWishlistUrl,
  fetchSteamAppDetails,
  fetchSteamWishlist,
  isExactSteamReleaseDate,
  isSteamCustomUrlName,
  isSteamId64,
  normalizeSteamProfileInput,
  normalizeSteamId64,
  parseWishlistApiJson,
  parseWishlistHtml,
  resolveSteamId64,
  SteamWishlistError,
} from "../client";

const steamId64 = "76561198115468824";

describe("steam client", () => {
  it("validates SteamID64 values", () => {
    expect(isSteamId64(steamId64)).toBe(true);
    expect(isSteamId64("nick")).toBe(false);
    expect(isSteamId64("https://example.com")).toBe(false);
  });

  it("validates Steam custom URL names", () => {
    expect(isSteamCustomUrlName("nickxudotme")).toBe(true);
    expect(isSteamCustomUrlName("nick-xu_dotme")).toBe(true);
    expect(isSteamCustomUrlName("nick/xu")).toBe(false);
    expect(isSteamCustomUrlName("")).toBe(false);
  });

  it("normalizes supported Steam profile URLs", () => {
    expect(normalizeSteamId64(steamId64)).toBe(steamId64);
    expect(normalizeSteamId64(`https://steamcommunity.com/profiles/${steamId64}/`)).toBe(steamId64);
    expect(
      normalizeSteamId64(`https://store.steampowered.com/wishlist/profiles/${steamId64}/`),
    ).toBe(steamId64);
    expect(
      normalizeSteamId64(`https://steamcommunity.com/profiles/${steamId64}?utm_source=copy`),
    ).toBe(steamId64);
    expect(
      normalizeSteamId64(
        `https://store.steampowered.com/wishlist/profiles/${steamId64}/#sort=order`,
      ),
    ).toBe(steamId64);
  });

  it("normalizes supported Steam profile input for the CLI adapter", () => {
    expect(normalizeSteamProfileInput(steamId64)).toBe(steamId64);
    expect(
      normalizeSteamProfileInput(
        `https://steamcommunity.com/profiles/${steamId64}/?utm_source=copy`,
      ),
    ).toBe(`https://steamcommunity.com/profiles/${steamId64}/`);
    expect(normalizeSteamProfileInput("https://steamcommunity.com/id/nickxudotme/")).toBe(
      "https://steamcommunity.com/id/nickxudotme/",
    );
    expect(
      normalizeSteamProfileInput(
        "https://store.steampowered.com/wishlist/id/nickxudotme/#sort=order",
      ),
    ).toBe("nickxudotme");
  });

  it("rejects unsupported Steam and arbitrary URLs", () => {
    expect(() =>
      normalizeSteamId64(`https://steamcommunity.com/profiles/${steamId64}/wishlist`),
    ).toThrow(SteamWishlistError);
    expect(() =>
      normalizeSteamProfileInput(`https://steamcommunity.com/profiles/${steamId64}/wishlist`),
    ).toThrow(SteamWishlistError);
    expect(() => normalizeSteamProfileInput("https://steamcommunity.com/id/nick/xu")).toThrow(
      SteamWishlistError,
    );
    expect(() => normalizeSteamId64("https://example.com/profiles/76561198115468824")).toThrow(
      SteamWishlistError,
    );
  });

  it("builds the public wishlist URL", () => {
    expect(buildWishlistUrl(steamId64)).toBe(
      "https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=76561198115468824",
    );
  });

  it("parses Steam wishlist API appIDs", () => {
    const json = JSON.stringify({
      response: {
        items: [
          { appid: 281990, priority: 2, date_added: 1653998488 },
          { appid: 1962700, priority: 0, date_added: 1778337224 },
        ],
      },
    });

    expect(parseWishlistApiJson(json)).toEqual([
      {
        appId: "281990",
        name: "Steam app 281990",
        releaseDateText: null,
        storeUrl: "https://store.steampowered.com/app/281990/",
      },
      {
        appId: "1962700",
        name: "Steam app 1962700",
        releaseDateText: null,
        storeUrl: "https://store.steampowered.com/app/1962700/",
      },
    ]);
  });

  it("parses wishlist data embedded in Steam HTML", () => {
    const html = `
      <script>
        var g_rgWishlistData = [{"appid":123,"name":"Hades II","release_date":{"date":"May 6, 2024"}},{"appid":"456","name":"Silksong","release_string":"Coming soon"}];
      </script>
    `;

    expect(parseWishlistHtml(html)).toEqual([
      {
        appId: "123",
        name: "Hades II",
        releaseDateText: "May 6, 2024",
        storeUrl: "https://store.steampowered.com/app/123/",
      },
      {
        appId: "456",
        name: "Silksong",
        releaseDateText: "Coming soon",
        storeUrl: "https://store.steampowered.com/app/456/",
      },
    ]);
  });

  it("parses rgApps embedded in Steam store item data", () => {
    const html = `
      <script>
        GStoreItemData.AddStoreItemDataSet({"rgApps":{"264710":{"name":"Subnautica","release_date":"Jan 23, 2018"},"848450":{"name":"Subnautica: Below Zero","release_string":"Coming soon"}}});
      </script>
    `;

    expect(parseWishlistHtml(html)).toEqual([
      {
        appId: "264710",
        name: "Subnautica",
        releaseDateText: "Jan 23, 2018",
        storeUrl: "https://store.steampowered.com/app/264710/",
      },
      {
        appId: "848450",
        name: "Subnautica: Below Zero",
        releaseDateText: "Coming soon",
        storeUrl: "https://store.steampowered.com/app/848450/",
      },
    ]);
  });

  it("detects Steam rate limit pages", () => {
    expect(() => parseWishlistHtml('<title>Wishlist - Error</title>{"error":"RateLimit"}')).toThrow(
      expect.objectContaining({ code: "wishlist_rate_limited" }),
    );
  });

  it("detects Steam welcome pages returned by wishlistdata endpoints", () => {
    expect(() => parseWishlistHtml("<title>Welcome to Steam</title>")).toThrow(
      expect.objectContaining({ code: "wishlist_private_or_unavailable" }),
    );
  });

  it("detects exact Steam release dates", () => {
    expect(isExactSteamReleaseDate("May 14, 2026")).toBe(true);
    expect(isExactSteamReleaseDate("Jan 23, 2018")).toBe(true);
    expect(isExactSteamReleaseDate("May 2026")).toBe(false);
    expect(isExactSteamReleaseDate("Coming soon")).toBe(false);
    expect(isExactSteamReleaseDate(null)).toBe(false);
  });

  it("fetches Steam app details", async () => {
    const response = new Response(
      JSON.stringify({
        "1962700": {
          success: true,
          data: {
            name: "Subnautica 2",
            short_description: "Dive into a new alien ocean world.",
            developers: ["Unknown Worlds Entertainment"],
            genres: [{ id: "25", description: "Adventure" }],
            publishers: ["KRAFTON, Inc."],
            release_date: { coming_soon: false, date: "May 14, 2026" },
          },
        },
      }),
      { status: 200 },
    );
    const calls: string[] = [];

    const result = await fetchSteamAppDetails("1962700", {
      fetcher: async (url) => {
        calls.push(url);
        return response;
      },
    });

    expect(calls).toHaveLength(1);
    const calledUrl = new URL(calls[0]);
    expect(`${calledUrl.origin}${calledUrl.pathname}`).toBe(
      "https://store.steampowered.com/api/appdetails",
    );
    expect(calledUrl.searchParams.get("appids")).toBe("1962700");
    expect(calledUrl.searchParams.get("filters")).toBe("price_overview,release_date,basic");
    expect(calledUrl.searchParams.get("cc")).toBe("US");
    expect(calledUrl.searchParams.get("l")).toBe("english");
    expect(result).toEqual({
      appId: "1962700",
      name: "Subnautica 2",
      shortDescription: "Dive into a new alien ocean world.",
      releaseDateText: "May 14, 2026",
      hasExactReleaseDate: true,
      storeUrl: "https://store.steampowered.com/app/1962700/",
      genres: ["Adventure"],
      developers: ["Unknown Worlds Entertainment"],
      publishers: ["KRAFTON, Inc."],
    });
  });

  it("fetches wishlist appIDs from Steam wishlist API", async () => {
    const response = new Response(JSON.stringify({ response: { items: [{ appid: 123 }] } }), {
      status: 200,
    });
    const calls: string[] = [];

    const result = await fetchSteamWishlist(steamId64, {
      fetcher: async (url) => {
        calls.push(url);
        return response;
      },
    });

    expect(calls).toEqual([
      "https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=76561198115468824",
    ]);
    expect(result.games).toHaveLength(1);
  });

  it("resolves custom Steam profile URLs before using the wishlist API fallback", async () => {
    const calls: string[] = [];

    const result = await fetchSteamWishlist("https://steamcommunity.com/id/nickxudotme/", {
      fetcher: async (url) => {
        calls.push(url);

        if (url.includes("steamcommunity.com/id/nickxudotme/")) {
          return new Response(`<profile><steamID64>${steamId64}</steamID64></profile>`, {
            status: 200,
          });
        }

        return new Response(JSON.stringify({ response: { items: [{ appid: 123 }] } }), {
          status: 200,
        });
      },
    });

    expect(calls).toEqual([
      "https://steamcommunity.com/id/nickxudotme/?xml=1",
      "https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=76561198115468824",
    ]);
    expect(result.steamId64).toBe(steamId64);
    expect(result.games).toHaveLength(1);
  });

  it("resolves custom Steam profile names", async () => {
    const result = await resolveSteamId64(
      "https://store.steampowered.com/wishlist/id/nickxudotme/",
      {
        fetcher: async (url) => {
          expect(url).toBe("https://steamcommunity.com/id/nickxudotme/?xml=1");
          return new Response(`<profile><steamID64>${steamId64}</steamID64></profile>`, {
            status: 200,
          });
        },
      },
    );

    expect(result).toBe(steamId64);
  });
});
