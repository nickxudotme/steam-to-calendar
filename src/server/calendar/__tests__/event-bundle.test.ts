import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CALENDAR_CONFIG } from "@/domain/calendar/config";

const integrationMocks = vi.hoisted(() => ({
  fetchSteamDealEvents: vi.fn(async () => []),
  fetchSteamMajorEvents: vi.fn(async () => []),
  fetchWatchedGameEvents: vi.fn(async (appIds: string[]) =>
    appIds.map((appId) => ({
      id: `${appId}-release`,
      title: `${appId} releases`,
      description: "Release",
      startDate: "2026-06-01",
      type: "wishlist_release" as const,
      appId,
    })),
  ),
  fetchWatchedGameSnapshots: vi.fn(async () => []),
}));

vi.mock("@/integrations/steam/deals", () => ({
  fetchSteamDealEvents: integrationMocks.fetchSteamDealEvents,
}));
vi.mock("@/integrations/steam/events", () => ({
  fetchSteamMajorEvents: integrationMocks.fetchSteamMajorEvents,
}));
vi.mock("@/integrations/steam/watched-games", () => ({
  fetchWatchedGameEvents: integrationMocks.fetchWatchedGameEvents,
  fetchWatchedGameSnapshots: integrationMocks.fetchWatchedGameSnapshots,
}));

import { fetchSteamCalendarEventBundle } from "../event-bundle";

describe("Steam calendar event bundle", () => {
  const originalBudget = process.env.STEAM_CALENDAR_WATCHED_APP_BUDGET;

  afterEach(() => {
    process.env.STEAM_CALENDAR_WATCHED_APP_BUDGET = originalBudget;
    vi.clearAllMocks();
  });

  it("applies a watched-app request budget before external lookups", async () => {
    process.env.STEAM_CALENDAR_WATCHED_APP_BUDGET = "2";

    const bundle = await fetchSteamCalendarEventBundle({
      appIds: ["10", "20", "30"],
      config: {
        ...DEFAULT_CALENDAR_CONFIG,
        includeDeals: false,
        includeSteamEvents: false,
      },
      locale: { cc: "US", lang: "english", uiLang: "en" },
    });

    expect(integrationMocks.fetchWatchedGameEvents).toHaveBeenCalledWith(
      ["10", "20"],
      expect.objectContaining({ cc: "US" }),
    );
    expect(bundle.events.map((event) => event.appId)).toEqual(["10", "20"]);
    expect(bundle.stats.skippedWatchedAppIds).toBe(1);
  });
});
