import { calendarConfigFromRecord } from "@/domain/calendar/config";
import { SteamWishlistError } from "@/integrations/steam/client";
import { normalizeCc, steamLocaleFromRequest } from "@/integrations/steam/locale";
import { fetchWishlistCalendarData } from "@/integrations/steam/pipeline";
import { fetchSteamCalendarEventBundle } from "@/server/calendar/event-bundle";
import { buildConnectedPreviewResponse } from "@/server/calendar/preview-response";
import {
  errorMessage,
  hashLogValue,
  logStructuredEvent,
  rawInput,
  requestId,
} from "@/server/observability";
import { steamApiErrorPayload, steamApiErrorStatus } from "@/server/steam-api-error";
import type { ConnectedPreviewStreamEvent } from "@/shared/calendar-preview";
import { isRecord, isString } from "@/shared/calendar-preview-contract";
import { WISHLIST_CONNECTED_EVENT } from "@/shared/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const currentRequestId = requestId(request);

  try {
    const body = await parsePreviewRequestBody(request);
    const config = calendarConfigFromRecord(body);
    const requestLocale = steamLocaleFromRequest(request);
    const locale = {
      ...requestLocale,
      cc: normalizeCc(String(body.cc ?? "")) || requestLocale.cc,
    };
    const steamInput = String(body.steamId64 ?? "");

    if (wantsStreamingPreview(request)) {
      return streamConnectedPreview({
        config,
        locale,
        request,
        requestId: currentRequestId,
        startedAt,
        steamId64: steamInput,
      });
    }

    const data = await fetchWishlistCalendarData(steamInput, {
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
    logWishlistPreviewResult({
      bundle,
      data,
      locale,
      request,
      requestId: currentRequestId,
      startedAt,
      status: 200,
      streaming: false,
      steamInput,
      useWishlist: shouldUseWishlist,
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

    logWishlistPreviewError({
      code,
      error,
      request,
      requestId: currentRequestId,
      startedAt,
      status,
    });

    return Response.json({ code, message }, { status });
  }
}

function wantsStreamingPreview(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const url = new URL(request.url);

  return accept.includes("application/x-ndjson") || url.searchParams.get("stream") === "1";
}

function streamConnectedPreview({
  config,
  locale,
  request,
  requestId,
  startedAt,
  steamId64,
}: {
  config: ReturnType<typeof calendarConfigFromRecord>;
  locale: ReturnType<typeof steamLocaleFromRequest>;
  request: Request;
  requestId: string | null;
  startedAt: number;
  steamId64: string;
}) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: ConnectedPreviewStreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          const data = await fetchWishlistCalendarData(steamId64, {
            ...locale,
            appLimit: 100,
          });
          const shouldUseWishlist = config.includeWishlist;

          if (shouldUseWishlist) {
            for (const games of chunkArray(data.wishlistGames, 8)) {
              send({
                type: "wishlist",
                games,
                profileName: data.profileName,
                stats: {
                  appDetails: data.appDetails.length,
                  skippedAppIds: data.skippedAppIds.length,
                  wishlistGames: data.wishlistGames.length,
                },
                steamId64: data.steamId64,
                wishlistUrl: data.wishlistUrl,
              });
            }
          }

          const bundle = await fetchSteamCalendarEventBundle({
            appIds: shouldUseWishlist
              ? data.wishlistGames.map((game) => game.appId)
              : config.watchedAppIds,
            config,
            locale,
            withWatchedGameSnapshots: shouldUseWishlist,
          });
          logWishlistPreviewResult({
            bundle,
            data,
            locale,
            request,
            requestId,
            startedAt,
            status: 200,
            streaming: true,
            steamInput: steamId64,
            useWishlist: shouldUseWishlist,
          });

          send({
            type: "done",
            preview: buildConnectedPreviewResponse({
              bundle,
              data,
              locale,
              useWishlist: shouldUseWishlist,
            }),
          });
        } catch (error) {
          const { code, message, status } = previewErrorResponse(error);

          logWishlistPreviewError({
            code,
            error,
            request,
            requestId,
            startedAt,
            status,
          });

          send({ type: "error", code, message, status });
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/x-ndjson; charset=utf-8",
      },
    },
  );
}

function logWishlistPreviewResult({
  bundle,
  data,
  locale,
  request,
  requestId,
  startedAt,
  status,
  streaming,
  steamInput,
  useWishlist,
}: {
  bundle: Awaited<ReturnType<typeof fetchSteamCalendarEventBundle>>;
  data: Awaited<ReturnType<typeof fetchWishlistCalendarData>>;
  locale: ReturnType<typeof steamLocaleFromRequest>;
  request: Request;
  requestId: string | null;
  startedAt: number;
  status: number;
  streaming: boolean;
  steamInput: string;
  useWishlist: boolean;
}) {
  logStructuredEvent(
    "info",
    useWishlist ? WISHLIST_CONNECTED_EVENT : "wishlist_preview_completed",
    {
      appDetails: data.appDetails.length,
      durationMs: Date.now() - startedAt,
      eventCount: bundle.events.length,
      locale: locale.lang,
      method: request.method,
      region: locale.cc,
      requestId,
      route: "/api/preview",
      skippedAppIds: data.skippedAppIds.length,
      status,
      ...rawInput({ steamInput }),
      steamIdHash: hashLogValue(data.steamId64),
      steamMajorEvents: bundle.stats.steamMajorEvents,
      streaming,
      useWishlist,
      wishlistGames: data.wishlistGames.length,
      wishlistReleaseEvents: bundle.stats.watchedGameEvents,
    },
    { request },
  );
}

function logWishlistPreviewError({
  code,
  error,
  request,
  requestId,
  startedAt,
  status,
}: {
  code: string;
  error: unknown;
  request: Request;
  requestId: string | null;
  startedAt: number;
  status: number;
}) {
  logStructuredEvent(
    "error",
    "wishlist_preview_failed",
    {
      code,
      durationMs: Date.now() - startedAt,
      error: errorMessage(error),
      method: request.method,
      requestId,
      route: "/api/preview",
      status,
    },
    { request },
  );
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
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
    const payload = steamApiErrorPayload(error, "Could not preview this Steam wishlist.");

    return {
      ...payload,
      status: steamApiErrorStatus(payload.code),
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
