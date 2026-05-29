import { describe, expect, it } from "vitest";
import {
  dropHistoricalLowWhenCurrencyMismatch,
  mapSteamDealEvents,
  mapSteamHistorySaleEvents,
  mapSteamMajorEvents,
  mapWishlistReleaseEvents,
  parseExactSteamReleaseDate,
  preferActiveStoreDealPrices,
} from "../event-mapper";
import type { SteamAppDetails } from "@/integrations/steam/client";

describe("event mapper", () => {
  it("parses exact Steam release dates into ISO dates", () => {
    expect(parseExactSteamReleaseDate("May 14, 2026")).toBe("2026-05-14");
    expect(parseExactSteamReleaseDate("Jan 3, 2018")).toBe("2018-01-03");
  });

  it("rejects non-exact release dates", () => {
    expect(parseExactSteamReleaseDate("May 2026")).toBeNull();
    expect(parseExactSteamReleaseDate("Coming soon")).toBeNull();
    expect(parseExactSteamReleaseDate("2026")).toBeNull();
  });

  it("maps exact wishlist release dates to calendar events", () => {
    const apps: SteamAppDetails[] = [
      {
        appId: "1962700",
        name: "Subnautica 2",
        shortDescription: "A survival adventure beneath an alien sea.",
        releaseDateText: "May 14, 2026",
        hasExactReleaseDate: true,
        storeUrl: "https://store.steampowered.com/app/1962700/",
      },
    ];

    expect(mapWishlistReleaseEvents(apps, { today: "2026-05-01" })).toEqual([
      {
        id: "steam-app-1962700-release",
        title: "🎮 Subnautica 2 releases",
        description:
          "A survival adventure beneath an alien sea.\nhttps://store.steampowered.com/app/1962700/",
        startDate: "2026-05-14",
        sourceUrl: "https://store.steampowered.com/app/1962700/",
        type: "wishlist_release",
        dataSource: "steam_store",
        appId: "1962700",
        releaseDateText: "May 14, 2026",
      },
    ]);
  });

  it("excludes wishlist apps without exact release dates", () => {
    const apps: SteamAppDetails[] = [
      {
        appId: "1",
        name: "Coming Soon Game",
        releaseDateText: "Coming soon",
        hasExactReleaseDate: false,
        storeUrl: "https://store.steampowered.com/app/1/",
      },
      {
        appId: "2",
        name: "Month Only Game",
        releaseDateText: "May 2026",
        hasExactReleaseDate: false,
        storeUrl: "https://store.steampowered.com/app/2/",
      },
    ];

    expect(mapWishlistReleaseEvents(apps)).toEqual([]);
  });

  it("excludes exact wishlist release dates that are already in the past", () => {
    const apps: SteamAppDetails[] = [
      {
        appId: "264710",
        name: "Subnautica",
        releaseDateText: "Jan 23, 2018",
        hasExactReleaseDate: true,
        storeUrl: "https://store.steampowered.com/app/264710/",
      },
    ];

    expect(mapWishlistReleaseEvents(apps, { today: "2026-05-20" })).toEqual([]);
  });

  it("maps Steam major events to calendar event ranges", () => {
    expect(
      mapSteamMajorEvents(
        [
          {
            id: "steam-summer-sale-2026",
            title: "Steam Summer Sale",
            startDate: "2026-06-25",
            endDate: "2026-07-10",
            description: "Major sale.",
            sourceUrl: "https://store.steampowered.com/",
          },
          {
            id: "steam-next-fest-june-2026",
            title: "Steam Next Fest",
            startDate: "2026-06-08",
            endDate: "2026-06-16",
          },
        ],
        { today: "2026-05-20" },
      ),
    ).toEqual([
      {
        id: "steam-summer-sale-2026",
        title: "🎮 Steam Summer Sale",
        description: "Major sale.",
        startDate: "2026-06-25",
        endDate: "2026-07-10",
        sourceUrl: "https://store.steampowered.com/",
        type: "steam_major_event",
        dataSource: "steam_events",
      },
      {
        id: "steam-next-fest-june-2026",
        title: "🎮 Steam Next Fest",
        description: "Steam Next Fest",
        startDate: "2026-06-08",
        endDate: "2026-06-16",
        sourceUrl: undefined,
        type: "steam_major_event",
        dataSource: "steam_events",
      },
    ]);
  });

  it("excludes Steam major events that have already ended", () => {
    expect(
      mapSteamMajorEvents(
        [
          {
            id: "steam-ended-sale-2026",
            title: "Steam Ended Sale",
            startDate: "2026-01-01",
            endDate: "2026-01-08",
          },
        ],
        { today: "2026-05-20" },
      ),
    ).toEqual([]);
  });

  it("maps Steam deal media image URLs onto discount events", () => {
    expect(
      mapSteamDealEvents(
        [
          {
            appid: 3472040,
            name: "NBA 2K26",
            discount: "-86%",
            original: "$69.99",
            final: "$9.79",
            review: "Build your own dynasty in MyCAREER and MyTEAM.",
            discount_end: Math.floor(Date.parse("2026-06-01T00:00:00.000Z") / 1000),
            image_url: "https://cdn.example.test/library_hero.jpg",
            url: "https://store.steampowered.com/app/3472040/NBA_2K26/",
          },
        ],
        { today: "2026-05-25" },
      ),
    ).toEqual([
      {
        id: "steam-app-3472040-deal",
        title: "-86% NBA 2K26",
        description: [
          "Build your own dynasty in MyCAREER and MyTEAM.",
          "Price: $9.79 (was $69.99)",
          "https://store.steampowered.com/app/3472040/NBA_2K26/",
        ].join("\n"),
        startDate: "2026-05-25",
        endDate: "2026-06-01",
        sourceUrl: "https://store.steampowered.com/app/3472040/NBA_2K26/",
        type: "steam_deal",
        dataSource: "steam_store",
        appId: "3472040",
        discount: "-86%",
        originalPrice: "$69.99",
        finalPrice: "$9.79",
        imageUrl: "https://cdn.example.test/library_hero.jpg",
        discountEnd: Math.floor(Date.parse("2026-06-01T00:00:00.000Z") / 1000),
      },
    ]);
  });

  it("maps Steam price history sale windows to full calendar ranges", () => {
    expect(
      mapSteamHistorySaleEvents(
        {
          appId: 264710,
          name: "Subnautica",
          imageUrl: "https://cdn.example.test/header.jpg",
          sales: [
            {
              start: "2026-05-11",
              start_at: "2026-05-11T17:18:51+02:00",
              start_unix: 1778512731,
              end: "2026-05-25",
              end_at: "2026-05-25T19:22:03+02:00",
              end_unix: 1779729723,
              store: "Steam",
              price: "7.49 USD",
              original: "29.99 USD",
              discount: "-75%",
              status: "finished",
              duration_days: 14,
            },
          ],
          sourceUrl: "https://store.steampowered.com/app/264710/Subnautica/",
        },
        { today: "2026-05-26" },
      ),
    ).toEqual([
      {
        id: "steam-app-264710-history-deal-2026-05-11-0",
        title: "-75% Subnautica",
        description: [
          "Price: 7.49 USD (was 29.99 USD)",
          "Store: Steam",
          "Status: finished",
          "https://store.steampowered.com/app/264710/Subnautica/",
        ].join("\n"),
        startDate: "2026-05-11",
        endDate: "2026-05-25",
        sourceUrl: "https://store.steampowered.com/app/264710/Subnautica/",
        type: "steam_deal",
        dataSource: "steam_history",
        appId: "264710",
        discount: "-75%",
        originalPrice: "29.99 USD",
        finalPrice: "7.49 USD",
        imageUrl: "https://cdn.example.test/header.jpg",
        discountStart: 1778512731,
        discountEnd: 1779729723,
        saleStatus: "finished",
        saleStore: "Steam",
      },
    ]);
  });

  it("keeps active history ranges but prefers live regional Steam store prices", () => {
    const [event] = mapSteamHistorySaleEvents(
      {
        appId: 3240220,
        name: "Grand Theft Auto V Enhanced",
        activeDiscountEnd: 1780938000,
        sales: [
          {
            start: "2026-05-26",
            start_unix: 1779729723,
            store: "Steam",
            price: "14.99 USD",
            original: "29.99 USD",
            discount: "-50%",
            status: "进行中",
          },
        ],
      },
      { today: "2026-05-29" },
    );

    expect(
      preferActiveStoreDealPrices([event], {
        finalPrice: "HK$ 116.50",
        originalPrice: "HK$ 233.00",
      }),
    ).toEqual([
      expect.objectContaining({
        dataSource: "steam_history",
        finalPrice: "HK$ 116.50",
        originalPrice: "HK$ 233.00",
        saleStatus: "进行中",
        startDate: "2026-05-26",
      }),
    ]);
    expect(
      preferActiveStoreDealPrices([event], {
        finalPrice: "HK$ 116.50",
        originalPrice: "HK$ 233.00",
      })[0].description,
    ).toContain("Price: HK$ 116.50 (was HK$ 233.00)");
  });

  it("drops historical lows when ITAD falls back to another currency", () => {
    expect(
      dropHistoricalLowWhenCurrencyMismatch(
        {
          id: "steam-app-3240220-watched-deal",
          title: "-50% Grand Theft Auto V Enhanced",
          description: "Price: HK$ 116.50 (was HK$ 233.00)",
          startDate: "2026-05-29",
          type: "steam_deal",
          finalPrice: "HK$ 116.50",
          originalPrice: "HK$ 233.00",
          historicalLowDate: "2019-06-14",
          historicalLowPrice: "8.80 USD",
          historicalLowStore: "GamesPlanet US",
        },
        "HK",
      ),
    ).toEqual(
      expect.not.objectContaining({
        historicalLowDate: expect.any(String),
        historicalLowPrice: expect.any(String),
        historicalLowStore: expect.any(String),
      }),
    );
  });
});
