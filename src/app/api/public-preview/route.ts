import { calendarConfigFromRequest } from "@/domain/calendar/config";
import { SteamWishlistError } from "@/integrations/steam/client";
import { steamLocaleFromRequest } from "@/integrations/steam/locale";
import { fetchSteamCalendarEventBundle } from "@/server/calendar/event-bundle";
import { buildPublicPreviewResponse } from "@/server/calendar/preview-response";

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
    });

    return Response.json(buildPublicPreviewResponse({ bundle, locale }));
  } catch (error) {
    const code = error instanceof SteamWishlistError ? error.code : "unknown_error";
    const message =
      error instanceof SteamWishlistError ? error.message : "Could not load Steam events.";

    return Response.json({ code, message }, { status: 502 });
  }
}
