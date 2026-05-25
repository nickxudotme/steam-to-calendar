type CacheEntry<T> = {
  expiresAt: number;
  pending?: Promise<T>;
  value?: T;
};

const DEFAULT_MAX_ENTRIES = 250;
const cache = new Map<string, CacheEntry<unknown>>();

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
      return existing.pending;
    }

    if ('value' in existing) {
      return existing.value as T;
    }
  }

  cache.delete(key);
  pruneExpired(now);

  const pending = loader()
    .then((value) => {
      cache.set(key, { expiresAt: Date.now() + ttlMs, value });
      pruneOverflow();
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { expiresAt: now + ttlMs, pending });
  pruneOverflow();
  return pending;
}

export function clearSteamCliCache(): void {
  cache.clear();
}

export function getSteamCliCacheStats(): { entries: number; pending: number } {
  let pending = 0;

  for (const entry of cache.values()) {
    if (entry.pending) {
      pending += 1;
    }
  }

  return { entries: cache.size, pending };
}

function pruneExpired(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function pruneOverflow(): void {
  const maxEntries = readNumberEnv('STEAM_CLI_CACHE_MAX_ENTRIES', DEFAULT_MAX_ENTRIES);

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
