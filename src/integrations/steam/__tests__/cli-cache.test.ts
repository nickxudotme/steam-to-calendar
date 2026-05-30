import { execFile } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSteamCliCache, getSteamCliCacheStats } from "../cache";
import { runSteamCliJson } from "../cli";

const childProcessMock = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  default: childProcessMock,
  execFile: childProcessMock.execFile,
}));

describe("steam-cli cache", () => {
  const originalSteamCliPath = process.env.STEAM_CLI_PATH;

  afterEach(() => {
    process.env.STEAM_CLI_PATH = originalSteamCliPath;
    clearSteamCliCache();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("reuses successful JSON results within the cache TTL", async () => {
    process.env.STEAM_CLI_PATH = "/tmp/steam-cli";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T00:00:00.000Z"));

    const callbacks: Array<(error: Error | null, stdout: string) => void> = [];
    vi.mocked(execFile).mockImplementation(((_binaryPath, _args, _options, callback) => {
      callbacks.push(callback as (error: Error | null, stdout: string) => void);
      return {};
    }) as typeof execFile);

    const first = runSteamCliJson<{ hits: number }>(["events"], { cacheTtlMs: 1_000 });
    const second = runSteamCliJson<{ hits: number }>(["events"], { cacheTtlMs: 1_000 });

    expect(execFile).toHaveBeenCalledTimes(1);
    callbacks[0](
      null,
      JSON.stringify({
        ok: true,
        command: "events",
        schema: "test",
        data: { hits: 1 },
      }),
    );

    await expect(Promise.all([first, second])).resolves.toEqual([{ hits: 1 }, { hits: 1 }]);

    await expect(
      runSteamCliJson<{ hits: number }>(["events"], { cacheTtlMs: 1_000 }),
    ).resolves.toEqual({ hits: 1 });
    expect(execFile).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-05-25T00:00:01.001Z"));
    const expired = runSteamCliJson<{ hits: number }>(["events"], { cacheTtlMs: 1_000 });
    expect(execFile).toHaveBeenCalledTimes(2);
    callbacks[1](
      null,
      JSON.stringify({
        ok: true,
        command: "events",
        schema: "test",
        data: { hits: 2 },
      }),
    );

    await expect(expired).resolves.toEqual({ hits: 2 });
  });

  it("falls back to a stale cached value when refresh fails", async () => {
    process.env.STEAM_CLI_PATH = "/tmp/steam-cli";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T00:00:00.000Z"));

    const callbacks: Array<(error: Error | null, stdout: string) => void> = [];
    vi.mocked(execFile).mockImplementation(((_binaryPath, _args, _options, callback) => {
      callbacks.push(callback as (error: Error | null, stdout: string) => void);
      return {};
    }) as typeof execFile);

    const first = runSteamCliJson<{ hits: number }>(["events"], { cacheTtlMs: 1_000 });
    callbacks[0](
      null,
      JSON.stringify({
        ok: true,
        command: "events",
        schema: "test",
        data: { hits: 1 },
      }),
    );
    await expect(first).resolves.toEqual({ hits: 1 });

    vi.setSystemTime(new Date("2026-05-25T00:00:01.001Z"));
    const stale = runSteamCliJson<{ hits: number }>(["events"], { cacheTtlMs: 1_000 });
    callbacks[1](new Error("Steam timed out"), "");

    await expect(stale).resolves.toEqual({ hits: 1 });
    expect(getSteamCliCacheStats()).toMatchObject({
      errors: 1,
      misses: 2,
      staleFallbacks: 1,
    });
  });
});
