import { getSteamCliCacheStats } from "@/integrations/steam/cache";
import { getSteamCliStatus } from "@/integrations/steam/cli";
import { logApiRequest } from "@/server/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request?: Request) {
  const startedAt = Date.now();
  const cache = getSteamCliCacheStats();
  const steamCli = getSteamCliStatus();

  if (request) {
    logApiRequest({
      event: "health_checked",
      fields: {
        cacheEntries: cache.entries,
        cachePending: cache.pending,
        steamCliAvailable: steamCli.available,
        steamCliSource: steamCli.source,
      },
      level: "info",
      request,
      route: "/api/health",
      startedAt,
      status: 200,
    });
  }

  return Response.json({
    ok: true,
    cache,
    steamCli,
  });
}
