import { describe, expect, it } from "vitest";
import { parseSearchResults } from "./api";

describe("calendar builder API client contract", () => {
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
