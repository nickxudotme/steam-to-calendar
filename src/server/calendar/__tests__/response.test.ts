import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCalendarHeadResponse, calendarErrorResponse, logCalendarRequest } from "../response";
import { SteamWishlistError } from "@/integrations/steam/client";

describe("calendar HTTP responses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds lightweight HEAD responses with calendar headers", async () => {
    const response = buildCalendarHeadResponse("76561198115468824");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(response.headers.get("content-disposition")).toContain("steam-to-calendar-wishlist.ics");
    expect(response.headers.get("content-disposition")).not.toContain("76561198115468824");
    expect(response.headers.get("cache-control")).toContain("max-age=1800");
    await expect(response.text()).resolves.toBe("");
  });

  it("maps invalid Steam IDs to 400 calendar errors", async () => {
    const response = calendarErrorResponse(
      new SteamWishlistError("invalid_steam_id", "Bad profile."),
      "invalid_steam_id: Bad profile.",
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("invalid_steam_id: Bad profile.");
  });

  it("logs structured calendar metadata without raw URLs or Steam IDs", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const request = new Request("https://example.test/cal/76561198115468824?cc=US&lang=english", {
      headers: {
        accept: "text/calendar",
        "user-agent": "CalendarBot/1.0",
      },
    });

    logCalendarRequest(request, new Response("ok", { status: 200 }), {
      durationMs: 12,
      route: "/cal/[steamId64]",
      steamId64: "76561198115468824",
    });

    expect(logSpy).toHaveBeenCalledWith(
      "[calendar-request]",
      expect.objectContaining({
        durationMs: 12,
        method: "GET",
        path: "/cal/[steam-id]",
        queryKeys: ["cc", "lang"],
        route: "/cal/[steamId64]",
        status: 200,
      }),
    );
    const payload = logSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.steamIdHash).toMatch(/^[a-f0-9]{12}$/);
    expect(payload).not.toHaveProperty("url");
    expect(payload).not.toHaveProperty("steamId64");
    expect(JSON.stringify(payload)).not.toContain("cc=US");
    expect(JSON.stringify(payload)).not.toContain("76561198115468824");
  });
});
