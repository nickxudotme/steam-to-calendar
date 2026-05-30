import { normalizeCc, steamLocaleFromRequest } from "@/integrations/steam/locale";
import { searchSteamGames } from "@/integrations/steam/search";
import { steamApiErrorResponse } from "@/server/steam-api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locale = steamLocaleFromRequest(request);
    const cc = normalizeCc(url.searchParams.get("cc")) ?? locale.cc;
    const query = url.searchParams.get("query") ?? "";
    const results = await searchSteamGames(query, { ...locale, cc, count: 8 });

    return Response.json({ results });
  } catch (error) {
    return steamApiErrorResponse(error, "Could not search Steam games.");
  }
}
