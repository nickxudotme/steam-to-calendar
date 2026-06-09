import { describe, expect, it } from "vitest";
import { SteamWishlistError } from "@/integrations/steam/client";
import { steamApiErrorPayload, steamApiErrorStatus } from "./steam-api-error";

describe("Steam API errors", () => {
  it("preserves Steam error codes for client copy", () => {
    expect(
      steamApiErrorPayload(
        new SteamWishlistError("wishlist_private_or_unavailable", "Private wishlist.", undefined, {
          profileSettingsUrl: "https://steamcommunity.com/id/nickxudotme/edit/settings",
        }),
        "Fallback",
      ),
    ).toEqual({
      code: "wishlist_private_or_unavailable",
      message: "Private wishlist.",
      profileSettingsUrl: "https://steamcommunity.com/id/nickxudotme/edit/settings",
    });
  });

  it("maps Steam failures to user-meaningful HTTP statuses", () => {
    expect(steamApiErrorStatus("invalid_steam_id")).toBe(400);
    expect(steamApiErrorStatus("wishlist_private_or_unavailable")).toBe(404);
    expect(steamApiErrorStatus("wishlist_rate_limited")).toBe(429);
    expect(steamApiErrorStatus("fetch_failed")).toBe(503);
    expect(steamApiErrorStatus("wishlist_parse_failed")).toBe(502);
  });
});
