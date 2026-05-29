import { calendarConfigFromRecord } from "@/domain/calendar/config";
import { SteamWishlistError } from "@/integrations/steam/client";
import { normalizeCc, steamLocaleFromRequest } from "@/integrations/steam/locale";
import { fetchWishlistCalendarData } from "@/integrations/steam/pipeline";
import { fetchSteamCalendarEventBundle } from "@/server/calendar/event-bundle";
import { buildConnectedPreviewResponse } from "@/server/calendar/preview-response";
import { isRecord, isString } from "@/shared/calendar-preview-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await parsePreviewRequestBody(request);
    const config = calendarConfigFromRecord(body);
    const requestLocale = steamLocaleFromRequest(request);
    const locale = {
      ...requestLocale,
      cc: normalizeCc(String(body.cc ?? "")) || requestLocale.cc,
    };
    const data = await fetchWishlistCalendarData(String(body.steamId64 ?? ""), {
      ...locale,
      appLimit: 100,
    });
    const shouldUseWishlist = config.includeWishlist;
    // When wishlist import is enabled, the wishlist itself becomes the watched app list.
    // Otherwise the request can still preview manually supplied app IDs.
    const bundle = await fetchSteamCalendarEventBundle({
      appIds: shouldUseWishlist
        ? data.wishlistGames.map((game) => game.appId)
        : config.watchedAppIds,
      config,
      locale,
      withWatchedGameSnapshots: shouldUseWishlist,
    });
    return Response.json(
      buildConnectedPreviewResponse({
        bundle,
        data,
        locale,
        useWishlist: shouldUseWishlist,
      }),
    );
  } catch (error) {
    const { code, message, status } = previewErrorResponse(error);

    return Response.json({ code, message }, { status });
  }
}

async function parsePreviewRequestBody(request: Request): Promise<Record<string, unknown>> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw new PreviewRequestError("invalid_json", "Request body must be valid JSON.");
  }

  if (!isRecord(payload)) {
    throw new PreviewRequestError("invalid_body", "Request body must be a JSON object.");
  }

  // Validate the public shape before parsing config so bad clients get precise 400 responses
  // instead of being silently coerced into defaults.
  if (!isString(payload.steamId64) || !payload.steamId64.trim()) {
    throw new PreviewRequestError("invalid_steam_id", "Steam ID or profile URL is required.");
  }

  validateOptionalString(payload, "cc");
  validateOptionalString(payload, "apps");
  validateOptionalString(payload, "eventTypes");
  validateOptionalBoolean(payload, "deals");
  validateOptionalBoolean(payload, "priceHistory");
  validateOptionalBoolean(payload, "events");
  validateOptionalBoolean(payload, "wishlist");
  validateOptionalNumber(payload, "count");
  validateOptionalNumber(payload, "pastDays");
  validateOptionalNumber(payload, "futureDays");

  return payload;
}

function validateOptionalString(payload: Record<string, unknown>, key: string) {
  if (payload[key] !== undefined && !isString(payload[key])) {
    throw new PreviewRequestError("invalid_request", `${key} must be a string.`);
  }
}

function validateOptionalBoolean(payload: Record<string, unknown>, key: string) {
  if (
    payload[key] !== undefined &&
    typeof payload[key] !== "boolean" &&
    !isString(payload[key]) &&
    typeof payload[key] !== "number"
  ) {
    throw new PreviewRequestError("invalid_request", `${key} must be a boolean-like value.`);
  }
}

function validateOptionalNumber(payload: Record<string, unknown>, key: string) {
  if (payload[key] !== undefined && typeof payload[key] !== "number" && !isString(payload[key])) {
    throw new PreviewRequestError("invalid_request", `${key} must be a number-like value.`);
  }
}

function previewErrorResponse(error: unknown) {
  if (error instanceof PreviewRequestError) {
    return { code: error.code, message: error.message, status: 400 };
  }

  if (error instanceof SteamWishlistError) {
    return {
      code: error.code,
      message: error.message,
      status: error.code === "invalid_steam_id" ? 400 : 502,
    };
  }

  return {
    code: "unknown_error",
    message: "Could not preview this Steam wishlist.",
    status: 502,
  };
}

class PreviewRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PreviewRequestError";
  }
}
