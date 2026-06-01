"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { CalendarConfig } from "@/domain/calendar/config";
import type { ConnectedPreviewStreamEvent, PreviewResponse } from "@/shared/calendar-preview";
import { fetchConnectedPreview } from "./api";

export function useWishlistPreview({
  calendarConfig,
  connectedSteamId64,
  effectiveSteamLang,
  effectiveStoreRegion,
  effectiveUiLang,
  onConnected,
  onDisconnected,
  publicPreviewRef,
  setPreview,
  setShowMyGames,
  webcalUrl,
}: {
  calendarConfig: CalendarConfig;
  connectedSteamId64: string | null;
  effectiveSteamLang: string;
  effectiveStoreRegion: string;
  effectiveUiLang: string;
  onConnected: () => void;
  onDisconnected: () => void;
  publicPreviewRef: MutableRefObject<PreviewResponse>;
  setPreview: Dispatch<SetStateAction<PreviewResponse>>;
  setShowMyGames: Dispatch<SetStateAction<boolean>>;
  webcalUrl: string;
}) {
  const [steamId64, setSteamId64] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const latestRequestRef = useRef(
    wishlistRequestContext(
      calendarConfig,
      effectiveStoreRegion,
      effectiveSteamLang,
      effectiveUiLang,
    ),
  );
  const lastAppliedRequestKeyRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    latestRequestRef.current = wishlistRequestContext(
      calendarConfig,
      effectiveStoreRegion,
      effectiveSteamLang,
      effectiveUiLang,
    );
  }, [calendarConfig, effectiveSteamLang, effectiveStoreRegion, effectiveUiLang]);

  useEffect(() => {
    if (!connectedSteamId64) {
      return;
    }

    const activeConnectedSteamId64 = connectedSteamId64;
    const requestContext = latestRequestRef.current;
    const requestKey = connectedWishlistRequestKey(activeConnectedSteamId64, requestContext);

    if (lastAppliedRequestKeyRef.current === requestKey) {
      return;
    }

    const requestId = ++requestSequenceRef.current;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    async function refreshConnectedPreview() {
      try {
        const payload = await fetchConnectedPreview({
          config: requestContext.calendarConfig,
          locale: requestContext.locale,
          onWishlist: (event) => {
            if (requestSequenceRef.current !== requestId) {
              return;
            }

            lastAppliedRequestKeyRef.current = requestKey;
            setPreview((currentPreview) =>
              applyWishlistStreamEvent(currentPreview, event, requestContext.locale),
            );
          },
          steamId64: activeConnectedSteamId64,
        });

        if (requestSequenceRef.current !== requestId) {
          return;
        }

        lastAppliedRequestKeyRef.current = requestKey;
        setPreview(payload);
      } catch (caught) {
        if (requestSequenceRef.current !== requestId) {
          return;
        }

        setErrorCode(caught instanceof Error && caught.name !== "Error" ? caught.name : null);
        setError(
          caught instanceof Error ? caught.message : "Could not preview this Steam wishlist.",
        );
      } finally {
        if (requestSequenceRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }

    void refreshConnectedPreview();
  }, [
    connectedSteamId64,
    setPreview,
    calendarConfig,
    effectiveSteamLang,
    effectiveStoreRegion,
    effectiveUiLang,
  ]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSteamId64 = steamId64.trim();

    if (!trimmedSteamId64) {
      // Empty import form means "just subscribe to the current public/manual calendar".
      window.location.href = webcalUrl;
      return;
    }

    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    const requestId = ++requestSequenceRef.current;
    let requestContext = latestRequestRef.current;
    let requestKey = connectedWishlistRequestKey(trimmedSteamId64, requestContext);
    let hasAppliedWishlistChunk = false;

    try {
      let payload = await fetchConnectedPreview({
        config: requestContext.calendarConfig,
        locale: requestContext.locale,
        onWishlist: (event) => {
          if (requestSequenceRef.current !== requestId) {
            return;
          }

          lastAppliedRequestKeyRef.current = connectedWishlistRequestKey(
            event.steamId64,
            requestContext,
          );
          setPreview((currentPreview) =>
            applyWishlistStreamEvent(currentPreview, event, requestContext.locale),
          );

          if (!hasAppliedWishlistChunk) {
            hasAppliedWishlistChunk = true;
            setShowMyGames(true);
            setIsImportOpen(false);
            onConnected();
          }
        },
        steamId64: trimmedSteamId64,
      });

      while (
        requestSequenceRef.current === requestId &&
        requestKey !== connectedWishlistRequestKey(trimmedSteamId64, latestRequestRef.current)
      ) {
        requestContext = latestRequestRef.current;
        requestKey = connectedWishlistRequestKey(trimmedSteamId64, requestContext);
        payload = await fetchConnectedPreview({
          config: requestContext.calendarConfig,
          locale: requestContext.locale,
          onWishlist: (event) => {
            if (requestSequenceRef.current !== requestId) {
              return;
            }

            lastAppliedRequestKeyRef.current = connectedWishlistRequestKey(
              event.steamId64,
              requestContext,
            );
            setPreview((currentPreview) =>
              applyWishlistStreamEvent(currentPreview, event, requestContext.locale),
            );
          },
          steamId64: trimmedSteamId64,
        });
      }

      if (requestSequenceRef.current !== requestId) {
        return;
      }

      lastAppliedRequestKeyRef.current = connectedWishlistRequestKey(
        payload.steamId64,
        requestContext,
      );
      setPreview(payload);
      setShowMyGames(true);
      setIsImportOpen(false);
      onConnected();
    } catch (caught) {
      setErrorCode(caught instanceof Error && caught.name !== "Error" ? caught.name : null);
      setError(caught instanceof Error ? caught.message : "Could not preview this Steam wishlist.");
    } finally {
      if (requestSequenceRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }

  function disconnect() {
    // Disconnecting is local UI state only; the app returns to the latest public preview cached
    // by usePublicPreviewLoader.
    requestSequenceRef.current += 1;
    lastAppliedRequestKeyRef.current = null;
    setPreview(publicPreviewRef.current);
    setSteamId64("");
    setError(null);
    setErrorCode(null);
    setIsImportOpen(false);
    onDisconnected();
  }

  return {
    disconnect,
    error,
    errorCode,
    isImportOpen,
    isLoading,
    openImport: () => setIsImportOpen(true),
    setSteamId64,
    steamId64,
    submit,
  };
}

function applyWishlistStreamEvent(
  currentPreview: PreviewResponse,
  event: Extract<ConnectedPreviewStreamEvent, { type: "wishlist" }>,
  locale: PreviewResponse["locale"],
): PreviewResponse {
  const isSameWishlist = currentPreview.steamId64 === event.steamId64;
  const wishlistGames = mergeWishlistGames(
    isSameWishlist ? (currentPreview.wishlistGames ?? []) : [],
    event.games,
  );

  return {
    ...currentPreview,
    steamId64: event.steamId64,
    feedPath: `/feed/${event.steamId64}.ics`,
    calendarPath: `/cal/${event.steamId64}`,
    wishlistUrl: event.wishlistUrl,
    ...(event.profileName !== undefined
      ? { profileName: event.profileName }
      : isSameWishlist
        ? { profileName: currentPreview.profileName }
        : {}),
    wishlistGames,
    locale,
    stats: {
      wishlistGames: event.stats.wishlistGames,
      appDetails: event.stats.appDetails,
      skippedAppIds: event.stats.skippedAppIds,
      wishlistReleaseEvents: isSameWishlist ? currentPreview.stats.wishlistReleaseEvents : 0,
      steamMajorEvents: isSameWishlist ? currentPreview.stats.steamMajorEvents : 0,
      ...(isSameWishlist && currentPreview.stats.priceHistoryEvents !== undefined
        ? { priceHistoryEvents: currentPreview.stats.priceHistoryEvents }
        : {}),
      ...(isSameWishlist && currentPreview.stats.skippedWatchedAppIds !== undefined
        ? { skippedWatchedAppIds: currentPreview.stats.skippedWatchedAppIds }
        : {}),
      ...(isSameWishlist && currentPreview.stats.storeFallbackEvents !== undefined
        ? { storeFallbackEvents: currentPreview.stats.storeFallbackEvents }
        : {}),
    },
    events: isSameWishlist ? currentPreview.events : [],
  };
}

function mergeWishlistGames(
  currentGames: NonNullable<PreviewResponse["wishlistGames"]>,
  nextGames: NonNullable<PreviewResponse["wishlistGames"]>,
) {
  const gamesByAppId = new Map(currentGames.map((game) => [game.appId, game]));

  for (const game of nextGames) {
    gamesByAppId.set(game.appId, {
      ...gamesByAppId.get(game.appId),
      ...game,
    });
  }

  return [...gamesByAppId.values()];
}

function wishlistRequestContext(
  calendarConfig: CalendarConfig,
  cc: string,
  lang: string,
  uiLang: string,
) {
  return {
    calendarConfig,
    locale: { cc, lang, uiLang },
  };
}

function connectedWishlistRequestKey(
  steamId64: string,
  requestContext: ReturnType<typeof wishlistRequestContext>,
) {
  return JSON.stringify({
    calendarConfig: requestContext.calendarConfig,
    locale: requestContext.locale,
    steamId64,
  });
}
