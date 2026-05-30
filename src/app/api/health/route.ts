import { getSteamCliCacheStats } from "@/integrations/steam/cache";
import { getSteamCliStatus } from "@/integrations/steam/cli";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json({
    ok: true,
    cache: getSteamCliCacheStats(),
    steamCli: getSteamCliStatus(),
  });
}
