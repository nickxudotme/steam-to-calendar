import { calendarConfigFromRequest } from "@/domain/calendar/config";
import { steamLocaleFromRequest } from "@/integrations/steam/locale";
import { fetchSteamCalendarEventBundle } from "@/server/calendar/event-bundle";
import { buildPublicPreviewResponse } from "@/server/calendar/preview-response";
import { errorMessage, logApiRequest } from "@/server/observability";
import {
  steamApiErrorPayload,
  steamApiErrorResponse,
  steamApiErrorStatus,
} from "@/server/steam-api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const locale = steamLocaleFromRequest(request);
    const config = calendarConfigFromRequest(request);
    const bundle = await fetchSteamCalendarEventBundle({
      appIds: config.watchedAppIds,
      config,
      locale,
      withWatchedGameSnapshots: true,
    });
    logApiRequest({
      event: "public_preview_loaded",
      fields: {
        appCount: config.watchedAppIds.length,
        eventCount: bundle.events.length,
        locale: locale.lang,
        region: locale.cc,
        steamMajorEvents: bundle.stats.steamMajorEvents,
        watchedGameEvents: bundle.stats.watchedGameEvents,
      },
      level: "info",
      request,
      route: "/api/public-preview",
      startedAt,
      status: 200,
    });

    return Response.json(buildPublicPreviewResponse({ bundle, locale }));
  } catch (error) {
    const payload = steamApiErrorPayload(error, "Could not load Steam events.");
    const status = steamApiErrorStatus(payload.code);
    logApiRequest({
      event: "public_preview_failed",
      fields: {
        code: payload.code,
        error: errorMessage(error),
      },
      level: "error",
      request,
      route: "/api/public-preview",
      startedAt,
      status,
    });

    return steamApiErrorResponse(error, "Could not load Steam events.");
  }
}
