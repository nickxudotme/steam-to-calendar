import { normalizeCc, steamLocaleFromRequest } from "@/integrations/steam/locale";
import { searchSteamGames } from "@/integrations/steam/search";
import { errorMessage, logApiRequest, rawInput } from "@/server/observability";
import {
  steamApiErrorPayload,
  steamApiErrorResponse,
  steamApiErrorStatus,
} from "@/server/steam-api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = Date.now();
  let query = "";
  let cc = "unknown";

  try {
    const url = new URL(request.url);
    const locale = steamLocaleFromRequest(request);
    cc = normalizeCc(url.searchParams.get("cc")) ?? locale.cc;
    query = url.searchParams.get("query") ?? "";
    const results = await searchSteamGames(query, { ...locale, cc, count: 8 });
    logApiRequest({
      event: "game_search_completed",
      fields: {
        ...rawInput({ query }),
        queryLength: query.trim().length,
        region: cc,
        resultCount: results.length,
      },
      level: "info",
      request,
      route: "/api/search-games",
      startedAt,
      status: 200,
    });

    return Response.json({ results });
  } catch (error) {
    const payload = steamApiErrorPayload(error, "Could not search Steam games.");
    const status = steamApiErrorStatus(payload.code);
    logApiRequest({
      event: "game_search_failed",
      fields: {
        code: payload.code,
        error: errorMessage(error),
        ...rawInput({ query }),
        queryLength: query.trim().length,
        region: cc,
      },
      level: "error",
      request,
      route: "/api/search-games",
      startedAt,
      status,
    });

    return steamApiErrorResponse(error, "Could not search Steam games.");
  }
}
