export const STEAM_EVENT_CATEGORIES = ['seasonal', 'fest', 'next_fest', 'store_sale'] as const;

export type SteamEventCategory = typeof STEAM_EVENT_CATEGORIES[number];

export type CalendarConfig = {
  includeDeals: boolean;
  includeSteamEvents: boolean;
  includeWishlist: boolean;
  watchedAppIds: string[];
  steamEventCategories: SteamEventCategory[];
  dealCount: number;
  eventPastDays: number;
  eventFutureDays: number;
};

export const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  includeDeals: true,
  includeSteamEvents: true,
  includeWishlist: true,
  watchedAppIds: [],
  steamEventCategories: ['seasonal', 'fest'],
  dealCount: 5,
  eventPastDays: 30,
  eventFutureDays: 180,
};

const DEAL_COUNT_MIN = 1;
const DEAL_COUNT_MAX = 50;
const PAST_DAYS_MIN = 0;
const PAST_DAYS_MAX = 730;
const FUTURE_DAYS_MIN = 1;
const FUTURE_DAYS_MAX = 1095;

export function calendarConfigFromRequest(request: Request): CalendarConfig {
  return calendarConfigFromSearchParams(new URL(request.url).searchParams);
}

export function calendarConfigFromRecord(input: Record<string, unknown>): CalendarConfig {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }

  return calendarConfigFromSearchParams(params);
}

export function calendarConfigFromSearchParams(params: URLSearchParams): CalendarConfig {
  return {
    includeDeals: readBoolean(params, 'deals', DEFAULT_CALENDAR_CONFIG.includeDeals),
    includeSteamEvents: readBoolean(params, 'events', DEFAULT_CALENDAR_CONFIG.includeSteamEvents),
    includeWishlist: readBoolean(params, 'wishlist', DEFAULT_CALENDAR_CONFIG.includeWishlist),
    watchedAppIds: readSteamAppIds(params),
    steamEventCategories: readSteamEventCategories(params),
    dealCount: readInteger(params, ['count', 'dealCount'], DEFAULT_CALENDAR_CONFIG.dealCount, DEAL_COUNT_MIN, DEAL_COUNT_MAX),
    eventPastDays: readInteger(params, 'pastDays', DEFAULT_CALENDAR_CONFIG.eventPastDays, PAST_DAYS_MIN, PAST_DAYS_MAX),
    eventFutureDays: readInteger(
      params,
      ['futureDays', 'nextDays'],
      DEFAULT_CALENDAR_CONFIG.eventFutureDays,
      FUTURE_DAYS_MIN,
      FUTURE_DAYS_MAX,
    ),
  };
}

export function calendarConfigToSearchParams(config: CalendarConfig): URLSearchParams {
  const params = new URLSearchParams();

  params.set('deals', config.includeDeals ? '1' : '0');
  params.set('events', config.includeSteamEvents ? '1' : '0');
  params.set('eventTypes', config.steamEventCategories.length ? config.steamEventCategories.join(',') : 'none');
  params.set('wishlist', config.includeWishlist ? '1' : '0');
  if (config.watchedAppIds.length) {
    params.set('apps', config.watchedAppIds.join(','));
  }
  params.set('count', String(config.dealCount));
  params.set('pastDays', String(config.eventPastDays));
  params.set('futureDays', String(config.eventFutureDays));

  return params;
}

function readSteamAppIds(params: URLSearchParams): string[] {
  const value = params.get('apps') ?? params.get('appIds');

  if (!value) {
    return DEFAULT_CALENDAR_CONFIG.watchedAppIds;
  }

  const appIds = value
    .split(',')
    .map((appId) => appId.trim())
    .filter((appId) => /^\d{1,10}$/.test(appId));

  return [...new Set(appIds)].slice(0, 25);
}

function readSteamEventCategories(params: URLSearchParams): SteamEventCategory[] {
  const value = params.get('eventTypes') ?? params.get('eventCategories');

  if (value === null) {
    return DEFAULT_CALENDAR_CONFIG.steamEventCategories;
  }

  if (value.trim() === '' || value.trim().toLowerCase() === 'none') {
    return [];
  }

  const categories = value
    .split(',')
    .map((category) => category.trim())
    .filter(isSteamEventCategory);

  return categories.length ? categories : DEFAULT_CALENDAR_CONFIG.steamEventCategories;
}

function isSteamEventCategory(value: string): value is SteamEventCategory {
  return STEAM_EVENT_CATEGORIES.includes(value as SteamEventCategory);
}

function readBoolean(params: URLSearchParams, key: string, fallback: boolean): boolean {
  const value = params.get(key);

  if (value === null) {
    return fallback;
  }

  if (/^(1|true|yes|on)$/i.test(value)) {
    return true;
  }

  if (/^(0|false|no|off)$/i.test(value)) {
    return false;
  }

  return fallback;
}

function readInteger(
  params: URLSearchParams,
  keys: string | string[],
  fallback: number,
  min: number,
  max: number,
): number {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const value = keyList.map((key) => params.get(key)).find((candidate) => candidate !== null);
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numberValue)));
}
