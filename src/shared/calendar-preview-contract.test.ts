import { describe, expect, it } from "vitest";
import { parsePreviewResponse } from "./calendar-preview-contract";

const validPreview = {
  steamId64: "steam-events",
  feedPath: "/feed/steam-events.ics",
  calendarPath: "/cal/steam-events",
  wishlistUrl: "",
  profileName: null,
  locale: { cc: "JP", lang: "japanese", uiLang: "en" },
  wishlistGames: [
    {
      appId: "123",
      developers: ["Supergiant"],
      genres: ["Action"],
      imageUrl: "https://example.test/header.jpg",
      name: "Hades II",
      price: {
        discountPercent: 20,
        finalFormatted: "¥ 2,300",
        initialFormatted: "¥ 2,875",
      },
      publishers: ["Supergiant"],
      releaseDateText: "May 6, 2024",
      reviewCount: 1200,
      reviewPercentage: 96,
      reviewSummary: "Very Positive",
      storeUrl: "https://store.steampowered.com/app/123/",
    },
  ],
  stats: {
    wishlistGames: 1,
    appDetails: 1,
    skippedAppIds: 0,
    wishlistReleaseEvents: 1,
    steamMajorEvents: 1,
    priceHistoryEvents: 1,
    skippedWatchedAppIds: 0,
    storeFallbackEvents: 0,
  },
  events: [
    {
      id: "steam-app-123-deal",
      title: "20% Hades II",
      description: "A deal",
      startDate: "2026-05-28",
      endDate: "2026-06-01",
      sourceUrl: "https://store.steampowered.com/app/123/",
      type: "steam_deal",
      dataSource: "steam_history",
      appId: "123",
      imageUrl: "https://example.test/header.jpg",
      discount: "20%",
      originalPrice: "¥ 2,875",
      finalPrice: "¥ 2,300",
      discountStart: 1779900000,
      discountEnd: 1780200000,
      historicalLowDate: "2024-11-27",
      historicalLowPrice: "¥ 1,980",
      historicalLowStore: "Steam",
      saleStatus: "active",
      saleStore: "steam",
      genres: ["Action"],
      reviewSummary: "Very Positive",
      reviewPercentage: 96,
      reviewCount: 1200,
      developers: ["Supergiant"],
      publishers: ["Supergiant"],
      releaseDateText: "May 6, 2024",
    },
    {
      id: "steam-next-fest",
      title: "Steam Next Fest",
      description: "Demo festival",
      startDate: "2026-06-08",
      endDate: "2026-06-16",
      type: "steam_major_event",
      dataSource: "steam_events",
      eventCategory: "next_fest",
    },
  ],
};

describe("calendar preview API contract", () => {
  it("accepts the full preview DTO shape rendered by the client", () => {
    expect(parsePreviewResponse(validPreview)).toEqual(validPreview);
  });

  it("rejects malformed optional event arrays before UI code renders them", () => {
    expect(() =>
      parsePreviewResponse({
        ...validPreview,
        events: [{ ...validPreview.events[0], genres: "Action" }],
      }),
    ).toThrow("invalid calendar preview response");
  });

  it("rejects invalid wishlist game price payloads", () => {
    expect(() =>
      parsePreviewResponse({
        ...validPreview,
        wishlistGames: [{ ...validPreview.wishlistGames[0], price: { discountPercent: "20" } }],
      }),
    ).toThrow("invalid wishlist games");
  });

  it("rejects unknown Steam event categories", () => {
    expect(() =>
      parsePreviewResponse({
        ...validPreview,
        events: [{ ...validPreview.events[1], eventCategory: "publisher" }],
      }),
    ).toThrow("invalid calendar preview response");
  });
});
