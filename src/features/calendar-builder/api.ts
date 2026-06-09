import { calendarConfigToSearchParams, type CalendarConfig } from "@/domain/calendar/config";
import type { ConnectedPreviewStreamEvent, PreviewResponse } from "@/shared/calendar-preview";
import {
  isPreviewWishlistGame,
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
  signal?: AbortSignal;
};

export type ConnectedPreviewRequest = {
  config: CalendarConfig;
  locale: CalendarBuilderLocale;
  onWishlist?: (event: Extract<ConnectedPreviewStreamEvent, { type: "wishlist" }>) => void;
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
  signal,
}: PublicPreviewRequest): Promise<PreviewResponse> {
  const params = calendarConfigToSearchParams(config);
  if (sendStoreRegion) {
    params.set("cc", locale.cc);
  }
  params.set("lang", locale.lang);
  params.set("uiLang", locale.uiLang);

  const response = await fetch(`/api/public-preview?${params.toString()}`, { signal });
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
  onWishlist,
  steamId64,
}: ConnectedPreviewRequest): Promise<PreviewResponse> {
  const previewParams = new URLSearchParams({
    lang: locale.lang,
    uiLang: locale.uiLang,
  });
  const response = await fetch(`/api/preview?${previewParams.toString()}`, {
    method: "POST",
    headers: {
      accept: onWishlist ? "application/x-ndjson" : "application/json",
      "content-type": "application/json",
    },
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

  if (onWishlist && isNdjsonResponse(response)) {
    return readConnectedPreviewStream(response, onWishlist);
  }

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
  const trimmedQuery = query.trim();
  const params = new URLSearchParams({
    cc: locale.cc,
    lang: locale.lang,
    query: trimmedQuery,
    uiLang: locale.uiLang,
  });
  const response = await fetch(`/api/search-games?${params.toString()}`);
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Could not search Steam games."));
  }

  const results = parseSearchResults(payload);

  return results;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

function isNdjsonResponse(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("application/x-ndjson");
}

async function readConnectedPreviewStream(
  response: Response,
  onWishlist: NonNullable<ConnectedPreviewRequest["onWishlist"]>,
): Promise<PreviewResponse> {
  if (!response.body) {
    throw new Error("Could not stream this Steam wishlist preview.");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseConnectedPreviewStreamEvent(line);

        if (event.type === "wishlist") {
          onWishlist(event);
        } else if (event.type === "done") {
          return event.preview;
        } else {
          throw streamError(event);
        }
      }
    }

    if (buffer.trim()) {
      const event = parseConnectedPreviewStreamEvent(buffer);

      if (event.type === "wishlist") {
        onWishlist(event);
      } else if (event.type === "done") {
        return event.preview;
      } else {
        throw streamError(event);
      }
    }
  } finally {
    reader.releaseLock();
  }

  throw new Error("Steam wishlist preview ended before it returned final calendar data.");
}

export function parseConnectedPreviewStreamEvent(line: string): ConnectedPreviewStreamEvent {
  let payload: unknown;

  try {
    payload = JSON.parse(line);
  } catch {
    throw new Error("API returned an invalid streaming preview event.");
  }

  if (!isRecord(payload) || !isString(payload.type)) {
    throw new Error("API returned an invalid streaming preview event.");
  }

  if (payload.type === "wishlist") {
    if (
      !isString(payload.steamId64) ||
      !isString(payload.wishlistUrl) ||
      !Array.isArray(payload.games) ||
      !payload.games.every(isPreviewWishlistGame) ||
      !isStreamWishlistStats(payload.stats) ||
      (payload.profileName !== undefined &&
        payload.profileName !== null &&
        !isString(payload.profileName))
    ) {
      throw new Error("API returned invalid streaming wishlist data.");
    }

    return {
      type: "wishlist",
      games: payload.games,
      ...(payload.profileName !== undefined ? { profileName: payload.profileName } : {}),
      stats: payload.stats,
      steamId64: payload.steamId64,
      wishlistUrl: payload.wishlistUrl,
    };
  }

  if (payload.type === "done") {
    return {
      type: "done",
      preview: parsePreviewResponse(payload.preview),
    };
  }

  if (
    payload.type === "error" &&
    isString(payload.code) &&
    isString(payload.message) &&
    isNumber(payload.status)
  ) {
    return {
      type: "error",
      code: payload.code,
      message: payload.message,
      status: payload.status,
    };
  }

  throw new Error("API returned an invalid streaming preview event.");
}

function isStreamWishlistStats(
  value: unknown,
): value is Extract<ConnectedPreviewStreamEvent, { type: "wishlist" }>["stats"] {
  return (
    isRecord(value) &&
    isNumber(value.appDetails) &&
    isNumber(value.skippedAppIds) &&
    isNumber(value.wishlistGames)
  );
}

function streamError(event: Extract<ConnectedPreviewStreamEvent, { type: "error" }>): Error {
  const error = new Error(event.message || "Could not preview this Steam wishlist.");
  error.name = event.code || "Error";
  return error;
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
    isOptionalString(value.currency) &&
    isOptionalString(value.finalFormatted) &&
    isOptionalString(value.initialFormatted)
  );
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isString(value);
}
