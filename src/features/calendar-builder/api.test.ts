import { describe, expect, it } from "vitest";
import { parseConnectedPreviewStreamEvent, parseSearchResults } from "./api";

describe("calendar builder API client contract", () => {
  it("accepts streaming wishlist progress events", () => {
    expect(
      parseConnectedPreviewStreamEvent(
        JSON.stringify({
          type: "wishlist",
          steamId64: "76561198115468824",
          wishlistUrl: "https://example.test/wishlist",
          profileName: "Nick",
          stats: {
            appDetails: 2,
            skippedAppIds: 0,
            wishlistGames: 2,
          },
          games: [
            {
              appId: "620",
              name: "Portal 2",
              releaseDateText: "Apr 18, 2011",
              storeUrl: "https://store.steampowered.com/app/620/",
            },
          ],
        }),
      ),
    ).toMatchObject({
      type: "wishlist",
      games: [{ appId: "620" }],
      stats: { wishlistGames: 2 },
    });
  });

  it("rejects malformed streaming wishlist progress events", () => {
    expect(() =>
      parseConnectedPreviewStreamEvent(
        JSON.stringify({
          type: "wishlist",
          steamId64: "76561198115468824",
          wishlistUrl: "https://example.test/wishlist",
          stats: {
            appDetails: 2,
            skippedAppIds: 0,
            wishlistGames: 2,
          },
          games: [
            {
              appId: "620",
              name: "Portal 2",
              releaseDateText: "Apr 18, 2011",
            },
          ],
        }),
      ),
    ).toThrow("invalid streaming wishlist data");
  });

  it("accepts streaming done events with final preview data", () => {
    expect(
      parseConnectedPreviewStreamEvent(
        JSON.stringify({
          type: "done",
          preview: {
            steamId64: "76561198115468824",
            feedPath: "/feed/76561198115468824.ics",
            calendarPath: "/cal/76561198115468824",
            wishlistUrl: "https://example.test/wishlist",
            stats: {
              wishlistGames: 1,
              appDetails: 1,
              skippedAppIds: 0,
              wishlistReleaseEvents: 0,
              steamMajorEvents: 0,
            },
            events: [],
          },
        }),
      ),
    ).toMatchObject({
      type: "done",
      preview: { steamId64: "76561198115468824" },
    });
  });

  it("accepts streaming error recovery settings URLs", () => {
    expect(
      parseConnectedPreviewStreamEvent(
        JSON.stringify({
          type: "error",
          code: "wishlist_private_or_unavailable",
          message: "Private wishlist.",
          profileSettingsUrl: "https://steamcommunity.com/id/nickxudotme/edit/settings",
          status: 404,
        }),
      ),
    ).toEqual({
      type: "error",
      code: "wishlist_private_or_unavailable",
      message: "Private wishlist.",
      profileSettingsUrl: "https://steamcommunity.com/id/nickxudotme/edit/settings",
      status: 404,
    });
  });

  it("accepts valid Steam search result payloads", () => {
    expect(
      parseSearchResults({
        results: [
          {
            appId: "123",
            name: "Hades II",
            imageUrl: "https://example.test/header.jpg",
            genres: ["Action"],
            price: {
              discountPercent: 20,
              finalFormatted: "$23.99",
              initialFormatted: "$29.99",
            },
            reviewCount: 1200,
            reviewPercentage: 96,
            reviewSummary: "Very Positive",
            storeUrl: "https://store.steampowered.com/app/123/",
          },
        ],
      }),
    ).toHaveLength(1);
  });

  it("rejects malformed search result price data", () => {
    expect(() =>
      parseSearchResults({
        results: [
          {
            appId: "123",
            name: "Hades II",
            price: { discountPercent: "20" },
            storeUrl: "https://store.steampowered.com/app/123/",
          },
        ],
      }),
    ).toThrow("invalid Steam search results");
  });
});
