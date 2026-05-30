import { STEAM_EVENTS_CALENDAR_ID } from "@/domain/calendar/constants";
import type { SteamWishlistGame } from "@/integrations/steam/client";
import type { SteamLocaleOptions } from "@/integrations/steam/locale";
import type { WishlistCalendarData } from "@/integrations/steam/pipeline";
import type { WatchedGameSnapshot } from "@/integrations/steam/watched-games";
import type { PreviewResponse, PreviewWishlistGame } from "@/shared/calendar-preview";
import type { SteamCalendarEventBundle } from "./event-bundle";

export function buildConnectedPreviewResponse({
  bundle,
  data,
  locale,
  useWishlist,
}: {
  bundle: SteamCalendarEventBundle;
  data: WishlistCalendarData;
  locale: SteamLocaleOptions;
  useWishlist: boolean;
}): PreviewResponse {
  // The preview response is the browser-facing view model. Server code keeps Steam-specific
  // objects private and sends one stable contract to React.
  const wishlistGames = useWishlist
    ? mergeWishlistGamesWithSnapshots(data.wishlistGames, bundle.watchedGameSnapshots)
    : data.wishlistGames;

  return {
    steamId64: data.steamId64,
    feedPath: `/feed/${data.steamId64}.ics`,
    calendarPath: `/cal/${data.steamId64}`,
    wishlistUrl: data.wishlistUrl,
    profileName: data.profileName,
    locale,
    wishlistGames,
    stats: {
      wishlistGames: data.wishlistGames.length,
      appDetails: data.appDetails.length,
      skippedAppIds: data.skippedAppIds.length,
      wishlistReleaseEvents: useWishlist ? bundle.stats.watchedGameEvents : 0,
      steamMajorEvents: bundle.stats.steamMajorEvents,
      priceHistoryEvents: bundle.stats.priceHistoryEvents,
      skippedWatchedAppIds: bundle.stats.skippedWatchedAppIds,
      storeFallbackEvents: bundle.stats.storeFallbackEvents,
    },
    events: bundle.events,
  };
}

export function buildPublicPreviewResponse({
  bundle,
  locale,
}: {
  bundle: SteamCalendarEventBundle;
  locale: SteamLocaleOptions;
}): PreviewResponse {
  return {
    steamId64: STEAM_EVENTS_CALENDAR_ID,
    feedPath: `/feed/${STEAM_EVENTS_CALENDAR_ID}.ics`,
    calendarPath: `/cal/${STEAM_EVENTS_CALENDAR_ID}`,
    wishlistUrl: "",
    locale,
    stats: {
      wishlistGames: 0,
      appDetails: 0,
      skippedAppIds: 0,
      wishlistReleaseEvents: bundle.stats.watchedGameEvents,
      steamMajorEvents: bundle.stats.steamMajorEvents,
      priceHistoryEvents: bundle.stats.priceHistoryEvents,
      skippedWatchedAppIds: bundle.stats.skippedWatchedAppIds,
      storeFallbackEvents: bundle.stats.storeFallbackEvents,
    },
    events: bundle.events,
  };
}

function mergeWishlistGamesWithSnapshots(
  games: SteamWishlistGame[],
  snapshots: WatchedGameSnapshot[],
): PreviewWishlistGame[] {
  const snapshotsByAppId = new Map(snapshots.map((snapshot) => [snapshot.appId, snapshot]));

  return games.map((game) => {
    const snapshot = snapshotsByAppId.get(game.appId);
    if (!snapshot) {
      return game;
    }

    // Prefer richer live snapshot fields, but preserve wishlist-only fields when Steam's app
    // detail endpoint does not return them.
    return {
      ...game,
      name: snapshot.name || game.name,
      ...(snapshot.imageUrl ? { imageUrl: snapshot.imageUrl } : {}),
      ...(snapshot.price ? { price: snapshot.price } : {}),
      ...(snapshot.genres?.length ? { genres: snapshot.genres } : {}),
      ...(snapshot.developers?.length ? { developers: snapshot.developers } : {}),
      ...(snapshot.publishers?.length ? { publishers: snapshot.publishers } : {}),
      ...(snapshot.reviewSummary ? { reviewSummary: snapshot.reviewSummary } : {}),
      ...(typeof snapshot.reviewPercentage === "number"
        ? { reviewPercentage: snapshot.reviewPercentage }
        : {}),
      ...(typeof snapshot.reviewCount === "number" ? { reviewCount: snapshot.reviewCount } : {}),
      releaseDateText: game.releaseDateText ?? snapshot.releaseDateText ?? null,
    };
  });
}
