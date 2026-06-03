import {
  mapSteamHistorySaleEvents,
  type CalendarEvent,
  type SteamHistorySale,
} from "@/domain/calendar/event-mapper";
import { STEAM_CLI_CACHE_TTL } from "@/integrations/steam/cache-policy";
import { runSteamCliJson, steamCliSupportsCommand } from "@/integrations/steam/cli";

type SteamCliHistoryResult = {
  appid: number;
  name: string;
  since?: string;
  scope: string;
  entries: unknown[];
  sales?: SteamHistorySale[];
};

type SteamHistoryOptions = {
  cc?: string;
  days?: number;
  lang?: string;
  uiLang?: string;
  useHistory?: boolean;
};

const loggedHistoryFallbackReasons = new Set<string>();

export async function fetchSteamHistorySaleEvents(
  appId: string | number,
  options: {
    activeDiscountEnd?: number;
    cc?: string;
    days?: number;
    imageUrl?: string;
    lang?: string;
    name?: string;
    review?: string;
    sourceUrl?: string;
    today?: string;
    uiLang?: string;
    useHistory?: boolean;
  } = {},
): Promise<CalendarEvent[]> {
  const data = await fetchSteamHistory(appId, options);

  if (!data?.sales?.length) {
    if (data) {
      logHistoryFallback("empty_sales", appId, options);
    }
    return [];
  }

  logHistorySuccess(appId, options, data.sales.length);

  return mapSteamHistorySaleEvents(
    {
      appId: data.appid,
      name: options.name?.trim() || data.name,
      sales: data.sales,
      sourceUrl: options.sourceUrl,
      imageUrl: options.imageUrl,
      review: options.review,
      activeDiscountEnd: options.activeDiscountEnd,
    },
    { storeRegion: options.cc, today: options.today },
  );
}

async function fetchSteamHistory(
  appId: string | number,
  options: SteamHistoryOptions,
): Promise<SteamCliHistoryResult | null> {
  if (options.useHistory === false) {
    logHistoryFallback("disabled_by_config", appId, options, { once: true });
    return null;
  }

  if (typeof options.days === "number" && options.days <= 0) {
    logHistoryFallback("non_positive_day_window", appId, options);
    return null;
  }

  if (!hasAdvancedPricingKey()) {
    logHistoryFallback("missing_itad_key", appId, options, { once: true });
    return null;
  }

  if (!(await steamCliSupportsCommand("history"))) {
    logHistoryFallback("unsupported_cli_command", appId, options, { once: true });
    return null;
  }

  try {
    return await runSteamCliJson<SteamCliHistoryResult>(
      ["history", String(appId), "--sales", "--days", String(options.days ?? 90)],
      {
        cacheTtlMs: STEAM_CLI_CACHE_TTL.history,
        cc: options.cc,
        lang: options.lang,
        processTimeoutMs: 30_000,
        uiLang: options.uiLang,
      },
    );
  } catch (error) {
    logHistoryFallback("query_failed", appId, options, { error });
    return null;
  }
}

function hasAdvancedPricingKey(): boolean {
  return Boolean(process.env.STEAM_CLI_ITAD_KEY?.trim());
}

function logHistorySuccess(
  appId: string | number,
  options: SteamHistoryOptions,
  saleCount: number,
) {
  console.info(
    [
      "[steam-history]",
      "status=success",
      `appId=${String(appId)}`,
      `sales=${saleCount}`,
      `days=${options.days ?? 90}`,
      `cc=${options.cc ?? "default"}`,
      `lang=${options.lang ?? "default"}`,
    ].join(" "),
  );
}

function logHistoryFallback(
  reason: string,
  appId: string | number,
  options: SteamHistoryOptions,
  details: { error?: unknown; once?: boolean } = {},
) {
  const dedupeKey = `${reason}:${options.cc ?? "default"}:${options.lang ?? "default"}`;
  if (details.once && loggedHistoryFallbackReasons.has(dedupeKey)) {
    return;
  }
  loggedHistoryFallbackReasons.add(dedupeKey);

  console.warn(
    [
      "[steam-history]",
      "status=fallback",
      `reason=${reason}`,
      `appId=${String(appId)}`,
      `days=${options.days ?? 90}`,
      `cc=${options.cc ?? "default"}`,
      `lang=${options.lang ?? "default"}`,
      errorLogPart(details.error),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function errorLogPart(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return `error=${JSON.stringify(error.message)}`;
  }

  return `error=${JSON.stringify(String(error))}`;
}
