export const STEAM_CLI_CACHE_TTL = {
  deals: readTtlMs('STEAM_CLI_DEALS_CACHE_TTL_MS', 10 * 60_000),
  events: readTtlMs('STEAM_CLI_EVENTS_CACHE_TTL_MS', 6 * 60 * 60_000),
  media: readTtlMs('STEAM_CLI_MEDIA_CACHE_TTL_MS', 24 * 60 * 60_000),
  search: readTtlMs('STEAM_CLI_SEARCH_CACHE_TTL_MS', 15 * 60_000),
  watchedApp: readTtlMs('STEAM_CLI_APP_CACHE_TTL_MS', 10 * 60_000),
  wishlist: readTtlMs('STEAM_CLI_WISHLIST_CACHE_TTL_MS', 5 * 60_000),
};

function readTtlMs(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
