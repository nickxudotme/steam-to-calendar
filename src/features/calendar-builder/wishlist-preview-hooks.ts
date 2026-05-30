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
import type { PreviewResponse } from "@/shared/calendar-preview";
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

    try {
      let payload = await fetchConnectedPreview({
        config: requestContext.calendarConfig,
        locale: requestContext.locale,
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
