import { calendarConfigToSearchParams, type CalendarConfig } from "@/domain/calendar/config";
import type { PreviewResponse } from "@/shared/calendar-preview";
import {
  isNumber,
  isOptionalNumber,
  isOptionalString,
  isRecord,
  isString,
  parsePreviewResponse,
} from "@/shared/calendar-preview-contract";
import type { GameSearchResult } from "./model";

type CalendarBuilderLocale = {
  cc: string;
  lang: string;
  uiLang: string;
};

type ApiErrorPayload = {
  code?: string;
  message?: string;
};

export type PublicPreviewRequest = {
  config: CalendarConfig;
  locale: CalendarBuilderLocale;
  sendStoreRegion: boolean;
};

export type ConnectedPreviewRequest = {
  config: CalendarConfig;
  locale: CalendarBuilderLocale;
  steamId64: string;
};

export type GameSearchRequest = {
  locale: CalendarBuilderLocale;
  query: string;
};

export async function fetchPublicPreview({
  config,
  locale,
  sendStoreRegion,
}: PublicPreviewRequest): Promise<PreviewResponse> {
  const params = calendarConfigToSearchParams(config);
  if (sendStoreRegion) {
    params.set("cc", locale.cc);
  }
  params.set("lang", locale.lang);
  params.set("uiLang", locale.uiLang);

  const response = await fetch(`/api/public-preview?${params.toString()}`);
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Could not load Steam events."));
  }

  // Treat API data as untrusted even though we own the server route. This catches broken
  // contracts early and keeps the React components working with known-good shapes.
  return parsePreviewResponse(payload);
}

export async function fetchConnectedPreview({
  config,
  locale,
  steamId64,
}: ConnectedPreviewRequest): Promise<PreviewResponse> {
  const previewParams = new URLSearchParams({
    lang: locale.lang,
    uiLang: locale.uiLang,
  });
  const response = await fetch(`/api/preview?${previewParams.toString()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      steamId64,
      cc: locale.cc,
      deals: config.includeDeals,
      priceHistory: config.includePriceHistory,
      events: config.includeSteamEvents,
      eventTypes: config.steamEventCategories.join(","),
      wishlist: true,
      apps: "",
      count: config.dealCount,
      pastDays: config.eventPastDays,
      futureDays: config.eventFutureDays,
    }),
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    const error = new Error(apiErrorMessage(payload, "Could not preview this Steam wishlist."));
    if (isApiErrorPayload(payload) && typeof payload.code === "string") {
      // The UI uses Error.name as a small error code channel for targeted copy.
      error.name = payload.code;
    }
    throw error;
  }

  // Keep the connected-wishlist contract identical to the public preview contract.
  return parsePreviewResponse(payload);
}

export async function searchCalendarGames({
  locale,
  query,
}: GameSearchRequest): Promise<GameSearchResult[]> {
  const params = new URLSearchParams({
    cc: locale.cc,
    lang: locale.lang,
    query,
    uiLang: locale.uiLang,
  });
  const response = await fetch(`/api/search-games?${params.toString()}`);
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Could not search Steam games."));
  }

  return parseSearchResults(payload);
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

export function parseSearchResults(payload: unknown): GameSearchResult[] {
  // Search results are smaller than PreviewResponse, so they have their own focused validator.
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.results) ||
    !payload.results.every(isSearchResult)
  ) {
    throw new Error("API returned invalid Steam search results.");
  }

  return payload.results;
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  return isApiErrorPayload(payload) && payload.message ? payload.message : fallback;
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return isRecord(value);
}

function isSearchResult(value: unknown): value is GameSearchResult {
  return (
    isRecord(value) &&
    isString(value.appId) &&
    isString(value.name) &&
    isString(value.storeUrl) &&
    isOptionalString(value.imageUrl) &&
    (value.price === undefined || isSearchPrice(value.price)) &&
    isOptionalNumber(value.reviewCount) &&
    isOptionalNumber(value.reviewPercentage) &&
    isOptionalString(value.reviewSummary) &&
    isOptionalNullableString(value.releaseDateText)
  );
}

function isSearchPrice(value: unknown): value is NonNullable<GameSearchResult["price"]> {
  return (
    isRecord(value) &&
    isNumber(value.discountPercent) &&
    isOptionalString(value.finalFormatted) &&
    isOptionalString(value.initialFormatted)
  );
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isString(value);
}
