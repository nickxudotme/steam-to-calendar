type CacheEntry<T> = {
  expiresAt: number;
  pending?: Promise<T>;
  staleExpiresAt?: number;
  value?: T;
};

const DEFAULT_MAX_ENTRIES = 250;
const DEFAULT_STALE_TTL_MS = 30 * 60_000;
const cache = new Map<string, CacheEntry<unknown>>();
const stats = {
  errors: 0,
  hits: 0,
  misses: 0,
  pendingHits: 0,
  staleFallbacks: 0,
};

export async function getCachedSteamCliValue<T>(
  key: string,
  ttlMs: number | undefined,
  loader: () => Promise<T>,
): Promise<T> {
  if (!ttlMs || ttlMs <= 0) {
    return loader();
  }

  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    if (existing.pending) {
      stats.pendingHits += 1;
      return existing.pending;
    }

    if ("value" in existing) {
      stats.hits += 1;
      return existing.value as T;
    }
  }

  stats.misses += 1;
  pruneExpired(now);

  const pending = loader()
    .then((value) => {
      cache.set(key, {
        expiresAt: Date.now() + ttlMs,
        staleExpiresAt: Date.now() + ttlMs + readStaleTtlMs(),
        value,
      });
      pruneOverflow();
      return value;
    })
    .catch((error) => {
      stats.errors += 1;
      if (
        existing &&
        "value" in existing &&
        typeof existing.staleExpiresAt === "number" &&
        existing.staleExpiresAt > Date.now()
      ) {
        stats.staleFallbacks += 1;
        cache.set(key, existing);
        return existing.value as T;
      }

      cache.delete(key);
      throw error;
    });

  cache.set(key, {
    expiresAt: now + ttlMs,
    pending,
    ...(existing && "value" in existing ? { staleExpiresAt: existing.staleExpiresAt } : {}),
    ...(existing && "value" in existing ? { value: existing.value } : {}),
  });
  pruneOverflow();
  return pending;
}

export function clearSteamCliCache(): void {
  cache.clear();
  stats.errors = 0;
  stats.hits = 0;
  stats.misses = 0;
  stats.pendingHits = 0;
  stats.staleFallbacks = 0;
}

export function getSteamCliCacheStats(): {
  entries: number;
  errors: number;
  hits: number;
  misses: number;
  pending: number;
  pendingHits: number;
  staleFallbacks: number;
} {
  let pending = 0;

  for (const entry of cache.values()) {
    if (entry.pending) {
      pending += 1;
    }
  }

  return { entries: cache.size, pending, ...stats };
}

function pruneExpired(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function pruneOverflow(): void {
  const maxEntries = readNumberEnv("STEAM_CLI_CACHE_MAX_ENTRIES", DEFAULT_MAX_ENTRIES);

  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;

    if (!oldestKey) {
      return;
    }

    cache.delete(oldestKey);
  }
}

function readNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStaleTtlMs(): number {
  return readNumberEnv("STEAM_CLI_CACHE_STALE_TTL_MS", DEFAULT_STALE_TTL_MS);
}
