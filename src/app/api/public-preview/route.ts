import { calendarConfigFromRequest } from "@/domain/calendar/config";
import { steamLocaleFromRequest } from "@/integrations/steam/locale";
import { fetchSteamCalendarEventBundle } from "@/server/calendar/event-bundle";
import { buildPublicPreviewResponse } from "@/server/calendar/preview-response";
import { steamApiErrorResponse } from "@/server/steam-api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const locale = steamLocaleFromRequest(request);
    const config = calendarConfigFromRequest(request);
    const bundle = await fetchSteamCalendarEventBundle({
      appIds: config.watchedAppIds,
      config,
      locale,
      withWatchedGameSnapshots: true,
    });

    return Response.json(buildPublicPreviewResponse({ bundle, locale }));
  } catch (error) {
    return steamApiErrorResponse(error, "Could not load Steam events.");
  }
}
