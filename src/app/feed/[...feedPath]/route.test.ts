import { beforeEach, describe, expect, it, vi } from "vitest";

const responseMocks = vi.hoisted(() => ({
  buildCalendarHeadResponse: vi.fn(
    (steamId64: string) => new Response(null, { headers: { "x-head-id": steamId64 } }),
  ),
  buildCalendarResponse: vi.fn(
    (steamId64: string) => new Response(`calendar ${steamId64}`, { status: 200 }),
  ),
  calendarErrorResponse: vi.fn((error: unknown, message: string) => {
    const status = error instanceof Error && message.startsWith("invalid_steam_id") ? 400 : 502;
    return new Response(message, { status });
  }),
  logCalendarRequest: vi.fn(),
}));

vi.mock("@/server/calendar/response", () => responseMocks);

import { GET, HEAD } from "./route";

function feedRequest(method: "GET" | "HEAD" = "GET", path = "/feed/steam-events.ics") {
  return new Request(`https://example.test${path}?events=1`, { method });
}

function routeContext(feedPath: string[] = ["steam-events.ics"]) {
  return {
    params: Promise.resolve({ feedPath }),
  };
}

describe("/feed/[...feedPath] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates full calendar responses for GET", async () => {
    const response = await GET(feedRequest(), routeContext());

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("calendar steam-events");
    expect(responseMocks.buildCalendarResponse).toHaveBeenCalledWith(
      "steam-events",
      expect.any(Request),
    );
    expect(responseMocks.buildCalendarHeadResponse).not.toHaveBeenCalled();
  });

  it("answers HEAD without generating the full calendar", async () => {
    const response = await HEAD(feedRequest("HEAD"), routeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("x-head-id")).toBe("steam-events");
    await expect(response.text()).resolves.toBe("");
    expect(responseMocks.buildCalendarHeadResponse).toHaveBeenCalledWith("steam-events");
    expect(responseMocks.buildCalendarResponse).not.toHaveBeenCalled();
  });

  it("rejects invalid feed paths consistently", async () => {
    const response = await HEAD(feedRequest("HEAD", "/feed/not-ics"), routeContext(["not-ics"]));

    expect(response.status).toBe(400);
    expect(responseMocks.calendarErrorResponse).toHaveBeenCalled();
  });
});
