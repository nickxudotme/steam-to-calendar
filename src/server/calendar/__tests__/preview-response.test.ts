import { describe, expect, it } from "vitest";
import type { SteamCalendarEventBundle } from "../event-bundle";
import { buildConnectedPreviewResponse, buildPublicPreviewResponse } from "../preview-response";

const emptyBundle: SteamCalendarEventBundle = {
  dealEvents: [],
  steamEvents: [],
  watchedGameEvents: [],
  watchedGameSnapshots: [],
  events: [],
  stats: {
    priceHistoryEvents: 0,
    skippedWatchedAppIds: 0,
    steamMajorEvents: 0,
    storeFallbackEvents: 0,
    watchedGameEvents: 0,
  },
};

describe("preview response builders", () => {
  it("builds public preview responses from the shared contract", () => {
    const response = buildPublicPreviewResponse({
      bundle: {
        ...emptyBundle,
        stats: {
          priceHistoryEvents: 1,
          skippedWatchedAppIds: 5,
          steamMajorEvents: 2,
          storeFallbackEvents: 3,
          watchedGameEvents: 4,
        },
      },
      locale: { cc: "US", lang: "english", uiLang: "en" },
    });

    expect(response).toMatchObject({
      steamId64: "steam-events",
      feedPath: "/feed/steam-events.ics",
      calendarPath: "/cal/steam-events",
      wishlistUrl: "",
      locale: { cc: "US", lang: "english", uiLang: "en" },
      watchedGames: [],
      stats: {
        wishlistGames: 0,
        appDetails: 0,
        skippedAppIds: 0,
        wishlistReleaseEvents: 4,
        steamMajorEvents: 2,
        priceHistoryEvents: 1,
        skippedWatchedAppIds: 5,
        storeFallbackEvents: 3,
      },
      events: [],
    });
  });

  it("merges wishlist games with watched-game snapshots for connected previews", () => {
    const response = buildConnectedPreviewResponse({
      bundle: {
        ...emptyBundle,
        watchedGameSnapshots: [
          {
            appId: "620",
            events: [],
            imageUrl: "https://cdn.example.test/portal-2.jpg",
            name: "Portal 2",
            releaseDateText: "Apr 18, 2011",
            reviewCount: 1000,
            storeUrl: "https://store.steampowered.com/app/620/",
          },
        ],
        stats: {
          ...emptyBundle.stats,
          watchedGameEvents: 1,
        },
      },
      data: {
        steamId64: "76561198115468824",
        profileName: "Nick Xu",
        wishlistUrl: "https://store.steampowered.com/wishlist/profiles/76561198115468824/",
        wishlistGames: [
          {
            appId: "620",
            name: "Old Portal 2",
            releaseDateText: null,
            storeUrl: "https://store.steampowered.com/app/620/",
          },
        ],
        appDetails: [],
        skippedAppIds: [],
      },
      locale: { cc: "US", lang: "english", uiLang: "en" },
      useWishlist: true,
    });

    expect(response.wishlistGames).toEqual([
      {
        appId: "620",
        imageUrl: "https://cdn.example.test/portal-2.jpg",
        name: "Portal 2",
        releaseDateText: "Apr 18, 2011",
        reviewCount: 1000,
        storeUrl: "https://store.steampowered.com/app/620/",
      },
    ]);
    expect(response.watchedGames).toEqual([
      {
        appId: "620",
        imageUrl: "https://cdn.example.test/portal-2.jpg",
        name: "Portal 2",
        releaseDateText: "Apr 18, 2011",
        reviewCount: 1000,
        storeUrl: "https://store.steampowered.com/app/620/",
      },
    ]);
    expect(response.stats.wishlistReleaseEvents).toBe(1);
  });
});
