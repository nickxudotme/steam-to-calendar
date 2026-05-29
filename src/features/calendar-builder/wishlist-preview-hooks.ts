"use client";

import {
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

    try {
      const payload = await fetchConnectedPreview({
        config: calendarConfig,
        locale: {
          cc: effectiveStoreRegion,
          lang: effectiveSteamLang,
          uiLang: effectiveUiLang,
        },
        steamId64: trimmedSteamId64,
      });

      setPreview(payload);
      setShowMyGames(true);
      setIsImportOpen(false);
      onConnected();
    } catch (caught) {
      setErrorCode(caught instanceof Error && caught.name !== "Error" ? caught.name : null);
      setError(caught instanceof Error ? caught.message : "Could not preview this Steam wishlist.");
    } finally {
      setIsLoading(false);
    }
  }

  function disconnect() {
    // Disconnecting is local UI state only; the app returns to the latest public preview cached
    // by usePublicPreviewLoader.
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
