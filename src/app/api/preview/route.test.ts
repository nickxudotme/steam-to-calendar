import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { WISHLIST_CONNECTED_EVENT } from "@/shared/observability";

const previewMocks = vi.hoisted(() => ({
  fetchSteamCalendarEventBundle: vi.fn(),
  fetchWishlistCalendarData: vi.fn(),
}));

vi.mock("@/integrations/steam/pipeline", () => ({
  fetchWishlistCalendarData: previewMocks.fetchWishlistCalendarData,
}));

vi.mock("@/server/calendar/event-bundle", () => ({
  fetchSteamCalendarEventBundle: previewMocks.fetchSteamCalendarEventBundle,
}));

function previewRequest(body: BodyInit, contentType = "application/json") {
  return new Request("https://example.test/api/preview?lang=english&uiLang=en", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

function streamingPreviewRequest(body: BodyInit) {
  return new Request("https://example.test/api/preview?lang=english&uiLang=en", {
    method: "POST",
    headers: {
      accept: "application/x-ndjson",
      "content-type": "application/json",
      "x-vercel-id": "iad1::abc123",
    },
    body,
  });
}

async function responseJson(response: Response) {
  return response.json() as Promise<{ code: string; message: string }>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("preview API request validation", () => {
  it("returns 400 for malformed JSON bodies", async () => {
    const response = await POST(previewRequest("{"));

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "invalid_json",
    });
  });

  it("returns 400 for non-object JSON bodies", async () => {
    const response = await POST(previewRequest(JSON.stringify(["76561198115468824"])));

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "invalid_body",
    });
  });

  it("returns 400 when steamId64 is missing", async () => {
    const response = await POST(previewRequest(JSON.stringify({ wishlist: true })));

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "invalid_steam_id",
    });
  });

  it("returns 400 for invalid config field shapes", async () => {
    const response = await POST(
      previewRequest(
        JSON.stringify({
          steamId64: "76561198115468824",
          count: { nested: true },
        }),
      ),
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "invalid_request",
    });
  });
});

describe("preview API streaming response", () => {
  it("streams wishlist games before the final connected preview", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    previewMocks.fetchWishlistCalendarData.mockResolvedValueOnce({
      steamId64: "76561198115468824",
      profileName: "Nick",
      wishlistUrl: "https://example.test/wishlist",
      wishlistGames: [
        {
          appId: "620",
          name: "Portal 2",
          releaseDateText: "Apr 18, 2011",
          storeUrl: "https://store.steampowered.com/app/620/",
        },
        {
          appId: "400",
          name: "Portal",
          releaseDateText: "Oct 10, 2007",
          storeUrl: "https://store.steampowered.com/app/400/",
        },
      ],
      appDetails: [{ appId: "620" }, { appId: "400" }],
      skippedAppIds: [],
    });
    previewMocks.fetchSteamCalendarEventBundle.mockResolvedValueOnce({
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
    });

    const response = await POST(
      streamingPreviewRequest(
        JSON.stringify({
          steamId64: "76561198115468824",
          wishlist: true,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");

    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; [key: string]: unknown });

    expect(events.map((event) => event.type)).toEqual(["wishlist", "done"]);
    expect(events[0]).toMatchObject({
      type: "wishlist",
      steamId64: "76561198115468824",
      games: [{ appId: "620" }, { appId: "400" }],
      stats: { wishlistGames: 2 },
    });
    expect(events[1]).toMatchObject({
      type: "done",
      preview: {
        steamId64: "76561198115468824",
        stats: { wishlistGames: 2 },
      },
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      appDetails: 2,
      event: WISHLIST_CONNECTED_EVENT,
      level: "info",
      method: "POST",
      requestId: "iad1::abc123",
      route: "/api/preview",
      status: 200,
      streaming: true,
      useWishlist: true,
      wishlistGames: 2,
    });
    expect(payload.steamIdHash).toMatch(/^[a-f0-9]{12}$/);
    expect(payload).not.toHaveProperty("steamId64");
    expect(JSON.stringify(payload)).not.toContain("76561198115468824");
  });
});
