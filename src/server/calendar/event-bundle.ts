import type { CalendarConfig } from "@/domain/calendar/config";
import type { CalendarEvent } from "@/domain/calendar/event-mapper";
import { fetchSteamDealEvents } from "@/integrations/steam/deals";
import { fetchSteamMajorEvents } from "@/integrations/steam/events";
import type { SteamLocaleOptions } from "@/integrations/steam/locale";
import {
  fetchWatchedGameEvents,
  fetchWatchedGameSnapshots,
  type WatchedGameSnapshot,
} from "@/integrations/steam/watched-games";

export type SteamCalendarEventBundle = {
  dealEvents: CalendarEvent[];
  steamEvents: CalendarEvent[];
  watchedGameEvents: CalendarEvent[];
  watchedGameSnapshots: WatchedGameSnapshot[];
  events: CalendarEvent[];
  stats: {
    priceHistoryEvents: number;
    steamMajorEvents: number;
    storeFallbackEvents: number;
    watchedGameEvents: number;
  };
};

export async function fetchSteamCalendarEventBundle({
  appIds,
  config,
  locale,
  withWatchedGameSnapshots = false,
}: {
  appIds: string[];
  config: CalendarConfig;
  locale: SteamLocaleOptions;
  withWatchedGameSnapshots?: boolean;
}): Promise<SteamCalendarEventBundle> {
  // Fetch independent event sources in parallel; each integration returns domain CalendarEvent
  // objects so the rest of the app can stay Steam-API-agnostic.
  const [dealEvents, steamEvents, watchedGames] = await Promise.all([
    config.includeDeals
      ? fetchSteamDealEvents({
          ...locale,
          count: config.dealCount,
          historyDays: config.eventPastDays,
          usePriceHistory: config.includePriceHistory,
        })
      : Promise.resolve([]),
    config.includeSteamEvents
      ? fetchSteamMajorEvents({
          ...locale,
          categories: config.steamEventCategories,
          futureDays: config.eventFutureDays,
          pastDays: config.eventPastDays,
        })
      : Promise.resolve([]),
    appIds.length
      ? fetchWatchedGames(appIds, config, locale, withWatchedGameSnapshots)
      : Promise.resolve({ events: [], snapshots: [] }),
  ]);
  // Keep ordering deterministic for UI lists, previews, and generated ICS snapshots.
  const events = [...dealEvents, ...watchedGames.events, ...steamEvents].sort(
    compareCalendarEvents,
  );

  return {
    dealEvents,
    steamEvents,
    watchedGameEvents: watchedGames.events,
    watchedGameSnapshots: watchedGames.snapshots,
    events,
    stats: {
      priceHistoryEvents: events.filter((event) => event.dataSource === "steam_history").length,
      steamMajorEvents: steamEvents.length,
      storeFallbackEvents: events.filter((event) => event.dataSource === "steam_store").length,
      watchedGameEvents: watchedGames.events.length,
    },
  };
}

async function fetchWatchedGames(
  appIds: string[],
  config: CalendarConfig,
  locale: SteamLocaleOptions,
  withSnapshots: boolean,
): Promise<{ events: CalendarEvent[]; snapshots: WatchedGameSnapshot[] }> {
  const options = {
    ...locale,
    historyDays: config.eventPastDays,
    usePriceHistory: config.includePriceHistory,
  };

  if (withSnapshots) {
    // Wishlist previews need snapshots so we can enrich the imported game list with current
    // prices, images, genres, and reviews, not just build calendar events.
    const snapshots = await fetchWatchedGameSnapshots(appIds, options);
    return {
      events: snapshots.flatMap((snapshot) => snapshot.events),
      snapshots,
    };
  }

  return {
    events: await fetchWatchedGameEvents(appIds, options),
    snapshots: [],
  };
}

function compareCalendarEvents(first: CalendarEvent, second: CalendarEvent): number {
  const dateComparison = first.startDate.localeCompare(second.startDate);
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return first.title.localeCompare(second.title);
}
