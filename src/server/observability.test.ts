import { afterEach, describe, expect, it, vi } from "vitest";
import { logApiRequest, rawInput } from "./observability";

const originalRawInputFlag = process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS;

describe("server observability", () => {
  afterEach(() => {
    if (originalRawInputFlag === undefined) {
      delete process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS;
    } else {
      process.env.OBSERVABILITY_CAPTURE_RAW_INPUTS = originalRawInputFlag;
    }
    vi.restoreAllMocks();
  });

  it("logs API metadata without raw query values", () => {
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
