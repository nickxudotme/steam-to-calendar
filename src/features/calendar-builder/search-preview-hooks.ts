"use client";

import { useState } from "react";
import type { PreviewEvent } from "@/shared/calendar-preview";
import type { GameSearchResult, SelectedGame } from "./model";

type SearchPreview = {
  game: GameSearchResult;
  left: number;
  top: number;
};

export function useSearchPreview({
  gameSearchResults,
  previewEvents,
}: {
  gameSearchResults: GameSearchResult[];
  previewEvents: PreviewEvent[];
}) {
  const [preview, setPreview] = useState<SearchPreview | null>(null);

  function clear() {
    setPreview(null);
  }

  function show(game: GameSearchResult, element: HTMLElement) {
    if (window.matchMedia("(max-width: 700px)").matches) {
      // On mobile the detail sheet is the preview surface; floating hover cards would fight it.
      clear();
      return;
    }

    const rect = element.getBoundingClientRect();
    const cardWidth = 280;
    const cardHeight = 340;
    const viewportPadding = 12;
    const gutter = 10;
    const preferredLeft = rect.right + gutter;
    const fallbackLeft = rect.left - cardWidth - gutter;
    const canPlaceRight = preferredLeft + cardWidth <= window.innerWidth - viewportPadding;
    const left = canPlaceRight ? preferredLeft : Math.max(viewportPadding, fallbackLeft);
    const maxTop = window.innerHeight - cardHeight - viewportPadding;
    const top = Math.min(Math.max(rect.top, viewportPadding), Math.max(viewportPadding, maxTop));

    setPreview({ game, left, top });
  }

  function showSelectedGame(game: SelectedGame, element: HTMLElement) {
    show(previewGameForSelectedGame(game, gameSearchResults, previewEvents), element);
  }

  return {
    clear,
    preview,
    show,
    showSelectedGame,
  };
}

function previewGameForSelectedGame(
  game: SelectedGame,
  gameSearchResults: GameSearchResult[],
  previewEvents: PreviewEvent[],
): GameSearchResult {
  const matchingSearchResult = gameSearchResults.find((result) => result.appId === game.appId);
  if (matchingSearchResult) {
    return {
      ...matchingSearchResult,
      name: game.name,
      ...(game.imageUrl ? { imageUrl: game.imageUrl } : {}),
      ...(game.genres?.length ? { genres: game.genres } : {}),
      ...(typeof game.reviewCount === "number" ? { reviewCount: game.reviewCount } : {}),
      ...(typeof game.reviewPercentage === "number"
        ? { reviewPercentage: game.reviewPercentage }
        : {}),
      ...(game.reviewSummary ? { reviewSummary: game.reviewSummary } : {}),
      ...(game.releaseDateText !== undefined ? { releaseDateText: game.releaseDateText } : {}),
      ...(game.price ? { price: game.price } : {}),
      storeUrl: game.storeUrl,
    };
  }

  const matchingEvent = previewEvents.find((event) => event.appId === game.appId);
  const discountPercent = matchingEvent?.discount?.match(/(\d+)/)?.[1];
  const eventPrice =
    matchingEvent?.finalPrice || matchingEvent?.originalPrice || discountPercent
      ? {
          discountPercent: discountPercent ? Number(discountPercent) : 0,
          ...(matchingEvent?.finalPrice ? { finalFormatted: matchingEvent.finalPrice } : {}),
          ...(matchingEvent?.originalPrice
            ? { initialFormatted: matchingEvent.originalPrice }
            : {}),
        }
      : null;
  const price = game.price ?? eventPrice ?? undefined;

  return {
    appId: game.appId,
    name: game.name,
    ...(game.imageUrl ? { imageUrl: game.imageUrl } : {}),
    genres: matchingEvent?.genres ?? game.genres,
    ...((matchingEvent?.reviewCount ?? game.reviewCount)
      ? { reviewCount: matchingEvent?.reviewCount ?? game.reviewCount }
      : {}),
    ...((matchingEvent?.reviewPercentage ?? game.reviewPercentage)
      ? { reviewPercentage: matchingEvent?.reviewPercentage ?? game.reviewPercentage }
      : {}),
    ...((matchingEvent?.reviewSummary ?? game.reviewSummary)
      ? { reviewSummary: matchingEvent?.reviewSummary ?? game.reviewSummary }
      : {}),
    ...(price ? { price } : {}),
    storeUrl: game.storeUrl,
  };
}
