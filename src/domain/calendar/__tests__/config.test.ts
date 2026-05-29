import { describe, expect, it } from "vitest";
import {
  calendarConfigFromRecord,
  calendarConfigFromSearchParams,
  calendarConfigToSearchParams,
  DEFAULT_CALENDAR_CONFIG,
} from "../config";

describe("calendar config query parameters", () => {
  it("uses the default public Steam Sale Calendar configuration when query params are absent", () => {
    expect(calendarConfigFromSearchParams(new URLSearchParams())).toEqual(DEFAULT_CALENDAR_CONFIG);
  });

  it("parses source toggles, deal count, and Steam event range from URL search params", () => {
    const config = calendarConfigFromSearchParams(
      new URLSearchParams({
        count: "9",
        deals: "0",
        events: "1",
        futureDays: "90",
        pastDays: "14",
        wishlist: "false",
      }),
    );

    expect(config).toEqual({
      includeDeals: false,
      includePriceHistory: true,
      includeSteamEvents: true,
      includeWishlist: false,
      watchedAppIds: [],
      steamEventCategories: ["seasonal", "fest"],
      dealCount: 9,
      eventPastDays: 14,
      eventFutureDays: 90,
    });
  });

  it("parses manually watched Steam app ids from URL search params", () => {
    const config = calendarConfigFromSearchParams(
      new URLSearchParams({
        apps: "264710,1962700,not-an-app,264710",
      }),
    );

    expect(config.watchedAppIds).toEqual(["264710", "1962700"]);
  });

  it("parses selected Steam event categories from URL search params", () => {
    const config = calendarConfigFromSearchParams(
      new URLSearchParams({
        eventTypes: "seasonal,next_fest,unknown",
      }),
    );

    expect(config.steamEventCategories).toEqual(["seasonal", "next_fest"]);
  });

  it("keeps an explicit empty Steam event category selection", () => {
    const config = calendarConfigFromSearchParams(
      new URLSearchParams({
        eventTypes: "none",
      }),
    );

    expect(config.steamEventCategories).toEqual([]);
  });

  it("clamps numeric params so calendar feeds cannot request unbounded data", () => {
    const config = calendarConfigFromSearchParams(
      new URLSearchParams({
        count: "500",
        futureDays: "5000",
        pastDays: "-10",
      }),
    );

    expect(config.dealCount).toBe(50);
    expect(config.eventPastDays).toBe(0);
    expect(config.eventFutureDays).toBe(1095);
  });

  it("round-trips body-style records into URL query params", () => {
    const config = calendarConfigFromRecord({
      count: 3,
      deals: true,
      events: false,
      eventTypes: "seasonal,store_sale",
      apps: "264710,1962700",
      futureDays: 180,
      pastDays: 7,
      wishlist: true,
    });
    const params = calendarConfigToSearchParams(config);

    expect(params.toString()).toBe(
      "deals=1&priceHistory=1&events=0&eventTypes=seasonal%2Cstore_sale&wishlist=1&apps=264710%2C1962700&count=3&pastDays=7&futureDays=180",
    );
  });

  it("round-trips the price history toggle", () => {
    const config = calendarConfigFromSearchParams(
      new URLSearchParams({
        priceHistory: "0",
      }),
    );

    expect(config.includePriceHistory).toBe(false);
    expect(calendarConfigToSearchParams(config).get("priceHistory")).toBe("0");
  });
});
