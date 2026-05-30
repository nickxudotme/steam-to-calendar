import { beforeEach, describe, expect, it, vi } from "vitest";

const responseMocks = vi.hoisted(() => ({
  buildCalendarHeadResponse: vi.fn(
    (steamId64: string) => new Response(null, { headers: { "x-head-id": steamId64 } }),
  ),
  buildCalendarResponse: vi.fn(
    (steamId64: string) => new Response(`calendar ${steamId64}`, { status: 200 }),
  ),
  logCalendarRequest: vi.fn(),
}));

vi.mock("@/server/calendar/response", () => responseMocks);

import { GET, HEAD } from "./route";

function calendarRequest(method: "GET" | "HEAD" = "GET") {
  return new Request("https://example.test/cal/76561198115468824?deals=0", { method });
}

function routeContext(steamId64 = "76561198115468824") {
  return {
    params: Promise.resolve({ steamId64 }),
  };
}

describe("/cal/[steamId64] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates full calendar responses for GET", async () => {
    const response = await GET(calendarRequest(), routeContext());

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("calendar 76561198115468824");
    expect(responseMocks.buildCalendarResponse).toHaveBeenCalledTimes(1);
    expect(responseMocks.buildCalendarHeadResponse).not.toHaveBeenCalled();
    expect(responseMocks.logCalendarRequest).toHaveBeenCalledWith(
      expect.any(Request),
      response,
      expect.objectContaining({
        route: "/cal/[steamId64]",
        steamId64: "76561198115468824",
      }),
    );
  });

  it("answers HEAD without generating the full calendar", async () => {
    const response = await HEAD(calendarRequest("HEAD"), routeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("x-head-id")).toBe("76561198115468824");
    await expect(response.text()).resolves.toBe("");
    expect(responseMocks.buildCalendarHeadResponse).toHaveBeenCalledTimes(1);
    expect(responseMocks.buildCalendarResponse).not.toHaveBeenCalled();
  });
});
