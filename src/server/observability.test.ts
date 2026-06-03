import { afterEach, describe, expect, it, vi } from "vitest";
import { logApiRequest, rawInput } from "./observability";

const originalRawInputFlag = process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS;
const originalUmamiWebsiteId = process.env.UMAMI_WEBSITE_ID;
const originalPublicUmamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const originalUmamiCollectUrl = process.env.UMAMI_COLLECT_URL;

describe("server observability", () => {
  afterEach(() => {
    if (originalRawInputFlag === undefined) {
      delete process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS;
    } else {
      process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS = originalRawInputFlag;
    }
    if (originalUmamiWebsiteId === undefined) {
      delete process.env.UMAMI_WEBSITE_ID;
    } else {
      process.env.UMAMI_WEBSITE_ID = originalUmamiWebsiteId;
    }
    if (originalPublicUmamiWebsiteId === undefined) {
      delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
    } else {
      process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = originalPublicUmamiWebsiteId;
    }
    if (originalUmamiCollectUrl === undefined) {
      delete process.env.UMAMI_COLLECT_URL;
    } else {
      process.env.UMAMI_COLLECT_URL = originalUmamiCollectUrl;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logs API metadata without raw query values", () => {
    delete process.env.UMAMI_WEBSITE_ID;
    delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const request = new Request("https://example.test/api/search-games?query=secret-game&cc=US", {
      headers: {
        "x-vercel-id": "iad1::abc123",
      },
    });

    logApiRequest({
      event: "game_search_completed",
      fields: {
        queryLength: 11,
        resultCount: 3,
      },
      level: "info",
      request,
      route: "/api/search-games",
      startedAt: Date.now(),
      status: 200,
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      event: "game_search_completed",
      path: "/api/search-games",
      queryKeys: ["cc", "query"],
      requestId: "iad1::abc123",
      route: "/api/search-games",
      status: 200,
    });
    expect(payload).not.toHaveProperty("url");
    expect(JSON.stringify(payload)).not.toContain("secret-game");
    expect(JSON.stringify(payload)).not.toContain("query=secret-game");
  });

  it("sends server API events to Umami when configured", () => {
    process.env.UMAMI_WEBSITE_ID = "website-id";
    process.env.UMAMI_COLLECT_URL = "https://analytics.example.test/api/send";
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const request = new Request("https://steamcalendar.com/api/search-games?query=secret&cc=US", {
      headers: {
        referer: "https://steamcalendar.com/",
        "user-agent": "TestBrowser/1.0",
      },
    });

    logApiRequest({
      event: "game_search_completed",
      fields: {
        queryKeys: ["cc", "query"],
        queryLength: 6,
        resultCount: 2,
      },
      level: "info",
      request,
      route: "/api/search-games",
      startedAt: Date.now(),
      status: 200,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://analytics.example.test/api/send",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      payload: {
        hostname: "steamcalendar.com",
        name: "game_search_completed",
        url: "/api/search-games",
        website: "website-id",
      },
      type: "event",
    });
  });

  it("includes the request query in Umami only when raw capture is enabled", () => {
    process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS = "1";
    process.env.UMAMI_WEBSITE_ID = "website-id";
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "log").mockImplementation(() => {});

    logApiRequest({
      event: "game_search_completed",
      level: "info",
      request: new Request("https://steamcalendar.com/api/search-games?query=secret&cc=US"),
      route: "/api/search-games",
      startedAt: Date.now(),
      status: 200,
    });

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      payload: {
        url: "/api/search-games?query=secret&cc=US",
      },
    });
  });

  it("does not send health checks to Umami", () => {
    process.env.UMAMI_WEBSITE_ID = "website-id";
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "log").mockImplementation(() => {});

    logApiRequest({
      event: "health_checked",
      level: "info",
      request: new Request("https://steamcalendar.com/api/health"),
      route: "/api/health",
      startedAt: Date.now(),
      status: 200,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("omits raw inputs unless explicitly enabled", () => {
    delete process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS;

    expect(rawInput({ query: "secret-game" })).toEqual({});
  });

  it("includes raw inputs behind the debug capture flag", () => {
    process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS = "1";

    expect(rawInput({ query: "secret-game" })).toEqual({
      rawInput: { query: "secret-game" },
    });
  });
});
