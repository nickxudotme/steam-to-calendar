import { STEAM_EVENT_CATEGORIES, type SteamEventCategory } from "@/domain/calendar/config";
import type { PreviewEvent, PreviewResponse, PreviewWishlistGame } from "./calendar-preview";

// Runtime validators for the JSON contract shared by Next.js route handlers and the browser.
// TypeScript types disappear at runtime, so these guards protect the UI from malformed payloads.
export function parsePreviewResponse(payload: unknown): PreviewResponse {
  if (
    !isRecord(payload) ||
    !isString(payload.steamId64) ||
    !isString(payload.feedPath) ||
    !isString(payload.calendarPath) ||
    !isString(payload.wishlistUrl) ||
    !isPreviewStats(payload.stats) ||
    !Array.isArray(payload.events) ||
    !payload.events.every(isPreviewEvent)
  ) {
    throw new Error("API returned an invalid calendar preview response.");
  }

  if (payload.locale !== undefined && !isPreviewLocale(payload.locale)) {
    throw new Error("API returned an invalid calendar preview locale.");
  }

  if (
    payload.profileName !== undefined &&
    payload.profileName !== null &&
    !isString(payload.profileName)
  ) {
    throw new Error("API returned an invalid calendar preview profile.");
  }

  if (
    payload.wishlistGames !== undefined &&
    (!Array.isArray(payload.wishlistGames) || !payload.wishlistGames.every(isPreviewWishlistGame))
  ) {
    throw new Error("API returned invalid wishlist games.");
  }

  return {
    steamId64: payload.steamId64,
    feedPath: payload.feedPath,
    calendarPath: payload.calendarPath,
    wishlistUrl: payload.wishlistUrl,
    ...(payload.profileName !== undefined ? { profileName: payload.profileName } : {}),
    ...(payload.wishlistGames !== undefined ? { wishlistGames: payload.wishlistGames } : {}),
    ...(payload.locale !== undefined ? { locale: payload.locale } : {}),
    stats: payload.stats,
    events: payload.events,
  };
}

export function isPreviewEvent(value: unknown): value is PreviewEvent {
  // PreviewEvent has many optional fields because different event sources expose different
  // metadata: Steam events, store deals, price history, and release dates do not all match.
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isString(value.description) &&
    isIsoDate(value.startDate) &&
    isOptionalIsoDate(value.endDate) &&
    isPreviewEventType(value.type) &&
    isOptionalDataSource(value.dataSource) &&
    isOptionalString(value.sourceUrl) &&
    isOptionalString(value.appId) &&
    isOptionalString(value.imageUrl) &&
    isOptionalString(value.discount) &&
    isOptionalString(value.originalPrice) &&
    isOptionalString(value.finalPrice) &&
    isOptionalNumber(value.releaseTime) &&
    isOptionalNumber(value.discountEnd) &&
    isOptionalNumber(value.discountStart) &&
    isOptionalIsoDate(value.historicalLowDate) &&
    isOptionalString(value.historicalLowPrice) &&
    isOptionalString(value.historicalLowStore) &&
    isOptionalString(value.saleStatus) &&
    isOptionalString(value.saleStore) &&
    isOptionalStringArray(value.genres) &&
    isOptionalString(value.reviewSummary) &&
    isOptionalNumber(value.reviewPercentage) &&
    isOptionalNumber(value.reviewCount) &&
    isOptionalStringArray(value.developers) &&
    isOptionalStringArray(value.publishers) &&
    isOptionalNullableString(value.releaseDateText) &&
    isOptionalSteamEventCategory(value.eventCategory)
  );
}

export function isPreviewWishlistGame(value: unknown): value is PreviewWishlistGame {
  return (
    isRecord(value) &&
    isString(value.appId) &&
    isString(value.name) &&
    isOptionalStringArray(value.developers) &&
    isOptionalStringArray(value.genres) &&
    isOptionalString(value.imageUrl) &&
    (value.price === undefined || isPreviewPrice(value.price)) &&
    isOptionalStringArray(value.publishers) &&
    isOptionalNullableString(value.releaseDateText) &&
    isOptionalNumber(value.reviewCount) &&
    isOptionalNumber(value.reviewPercentage) &&
    isOptionalString(value.reviewSummary) &&
    isString(value.storeUrl)
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isNumber(value);
}

function isPreviewStats(value: unknown): value is PreviewResponse["stats"] {
  return (
    isRecord(value) &&
    isNumber(value.wishlistGames) &&
    isNumber(value.appDetails) &&
    isNumber(value.skippedAppIds) &&
    isNumber(value.wishlistReleaseEvents) &&
    isNumber(value.steamMajorEvents) &&
    isOptionalNumber(value.priceHistoryEvents) &&
    isOptionalNumber(value.skippedWatchedAppIds) &&
    isOptionalNumber(value.storeFallbackEvents)
  );
}

function isPreviewLocale(value: unknown): value is NonNullable<PreviewResponse["locale"]> {
  return isRecord(value) && isString(value.cc) && isString(value.lang) && isString(value.uiLang);
}

function isPreviewEventType(value: unknown): value is PreviewEvent["type"] {
  return (
    value === "wishlist_release" ||
    value === "steam_major_event" ||
    value === "steam_deal" ||
    value === "steam_preorder"
  );
}

function isOptionalDataSource(value: unknown): value is PreviewEvent["dataSource"] | undefined {
  return (
    value === undefined ||
    value === "steam_history" ||
    value === "steam_store" ||
    value === "steam_events"
  );
}

function isOptionalSteamEventCategory(value: unknown): value is SteamEventCategory | undefined {
  // Keep event categories tied to the domain config instead of accepting arbitrary strings.
  return value === undefined || STEAM_EVENT_CATEGORIES.includes(value as SteamEventCategory);
}

function isPreviewPrice(value: unknown): value is NonNullable<PreviewWishlistGame["price"]> {
  return (
    isRecord(value) &&
    isNumber(value.discountPercent) &&
    isOptionalString(value.finalFormatted) &&
    isOptionalString(value.initialFormatted)
  );
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(isString));
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isString(value);
}

function isIsoDate(value: unknown): value is string {
  return isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isOptionalIsoDate(value: unknown): value is string | undefined {
  return value === undefined || isIsoDate(value);
}
