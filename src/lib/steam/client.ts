export type SteamWishlistGame = {
  appId: string;
  name: string;
  releaseDateText: string | null;
  storeUrl: string;
};

export type SteamAppDetails = {
  appId: string;
  name: string;
  releaseDateText: string | null;
  hasExactReleaseDate: boolean;
  storeUrl: string;
};

export type SteamWishlistResult = {
  steamId64: string;
  wishlistUrl: string;
  games: SteamWishlistGame[];
};

export type SteamWishlistErrorCode =
  | 'invalid_steam_id'
  | 'fetch_failed'
  | 'wishlist_private_or_unavailable'
  | 'wishlist_rate_limited'
  | 'wishlist_parse_failed'
  | 'app_details_unavailable'
  | 'app_details_parse_failed';

export class SteamWishlistError extends Error {
  constructor(
    readonly code: SteamWishlistErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SteamWishlistError';
  }
}

const STEAM_ID_64_PATTERN = /^7656\d{13}$/;
const STEAM_CUSTOM_URL_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULT_TIMEOUT_MS = 10_000;

export function isSteamId64(value: string): boolean {
  return STEAM_ID_64_PATTERN.test(value.trim());
}

export function isSteamCustomUrlName(value: string): boolean {
  return STEAM_CUSTOM_URL_PATTERN.test(value.trim());
}

export function normalizeSteamId64(input: string): string {
  const value = input.trim();

  if (isSteamId64(value)) {
    return value;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SteamWishlistError('invalid_steam_id', 'Enter a SteamID64 or a supported Steam profile URL.');
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  if (
    hostname === 'steamcommunity.com'
    && segments.length === 2
    && segments[0].toLowerCase() === 'profiles'
    && isSteamId64(segments[1])
  ) {
    return segments[1];
  }

  if (
    hostname === 'store.steampowered.com'
    && segments.length === 3
    && segments[0].toLowerCase() === 'wishlist'
    && segments[1].toLowerCase() === 'profiles'
    && isSteamId64(segments[2])
  ) {
    return segments[2];
  }

  throw new SteamWishlistError('invalid_steam_id', 'Enter a SteamID64 or a supported Steam profile URL.');
}

export function normalizeSteamProfileInput(input: string): string {
  const value = input.trim();

  if (isSteamId64(value)) {
    return value;
  }

  const steamInput = extractSupportedSteamProfileUrl(value);
  if (steamInput) {
    return steamInput;
  }

  throw new SteamWishlistError(
    'invalid_steam_id',
    'Enter a SteamID64, custom Steam profile URL, or supported Steam wishlist URL.',
  );
}

function extractSupportedSteamProfileUrl(value: string): string | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  if (
    hostname === 'steamcommunity.com'
    && segments.length === 2
    && segments[0].toLowerCase() === 'profiles'
    && isSteamId64(segments[1])
  ) {
    return `https://steamcommunity.com/profiles/${segments[1]}/`;
  }

  if (
    hostname === 'steamcommunity.com'
    && segments.length === 2
    && segments[0].toLowerCase() === 'id'
    && isSteamCustomUrlName(segments[1])
  ) {
    return `https://steamcommunity.com/id/${segments[1]}/`;
  }

  if (
    hostname === 'store.steampowered.com'
    && segments.length === 3
    && segments[0].toLowerCase() === 'wishlist'
    && segments[1].toLowerCase() === 'profiles'
    && isSteamId64(segments[2])
  ) {
    return segments[2];
  }

  if (
    hostname === 'store.steampowered.com'
    && segments.length === 3
    && segments[0].toLowerCase() === 'wishlist'
    && segments[1].toLowerCase() === 'id'
    && isSteamCustomUrlName(segments[2])
  ) {
    return segments[2];
  }

  return null;
}

export async function resolveSteamId64(
  input: string,
  options: { fetcher?: FetchLike; timeoutMs?: number } = {},
): Promise<string> {
  try {
    return normalizeSteamId64(input);
  } catch {
    // Custom profile URLs need a Steam Community profile lookup.
  }

  const steamInput = normalizeSteamProfileInput(input);

  if (isSteamId64(steamInput)) {
    return steamInput;
  }

  const profileUrl = buildProfileXmlUrl(steamInput);
  const xml = await fetchText(profileUrl, options);
  const match = xml.match(/<steamID64>(7656\d{13})<\/steamID64>/);

  if (!match) {
    throw new SteamWishlistError('invalid_steam_id', 'Could not resolve this custom Steam profile URL.');
  }

  return match[1];
}

function buildProfileXmlUrl(steamInput: string): string {
  let url: URL;

  try {
    url = new URL(steamInput);
  } catch {
    return `https://steamcommunity.com/id/${encodeURIComponent(steamInput)}/?xml=1`;
  }

  if (url.hostname.toLowerCase().replace(/^www\./, '') !== 'steamcommunity.com') {
    return `https://steamcommunity.com/id/${encodeURIComponent(steamInput)}/?xml=1`;
  }

  url.search = 'xml=1';
  url.hash = '';
  return url.toString();
}

export function buildWishlistUrl(steamId64: string): string {
  if (!isSteamId64(steamId64)) {
    throw new SteamWishlistError('invalid_steam_id', 'Invalid SteamID64.');
  }

  return `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${steamId64}`;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function fetchSteamAppDetails(
  appId: string,
  options: { fetcher?: FetchLike; timeoutMs?: number } = {},
): Promise<SteamAppDetails> {
  if (!/^\d+$/.test(appId)) {
    throw new SteamWishlistError('app_details_unavailable', 'Invalid Steam appID.');
  }

  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=price_overview,release_date,basic&cc=us&l=en`;
  const text = await fetchText(url, options);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new SteamWishlistError('app_details_parse_failed', 'Could not parse Steam app details.', error);
  }

  const appPayload = payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>)[appId]
    : null;

  if (!appPayload || typeof appPayload !== 'object') {
    throw new SteamWishlistError('app_details_parse_failed', 'Steam app details had an unexpected shape.');
  }

  const appRecord = appPayload as Record<string, unknown>;
  if (appRecord.success !== true || !appRecord.data || typeof appRecord.data !== 'object') {
    throw new SteamWishlistError('app_details_unavailable', 'Steam app details are unavailable.');
  }

  const data = appRecord.data as Record<string, unknown>;
  const name = readString(data, 'name') ?? `Steam app ${appId}`;
  const releaseDateText = readReleaseDate(data);

  return {
    appId,
    name,
    releaseDateText,
    hasExactReleaseDate: isExactSteamReleaseDate(releaseDateText),
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
  };
}

export function isExactSteamReleaseDate(releaseDateText: string | null): boolean {
  if (!releaseDateText) {
    return false;
  }

  return /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(releaseDateText);
}

export async function fetchSteamWishlist(
  input: string,
  options: { fetcher?: FetchLike; timeoutMs?: number } = {},
): Promise<SteamWishlistResult> {
  const steamId64 = await resolveSteamId64(input, options);
  const wishlistUrl = buildWishlistUrl(steamId64);
  const json = await fetchText(wishlistUrl, options);
  const games = parseWishlistApiJson(json);

  if (games.length === 0) {
    throw new SteamWishlistError(
      'wishlist_private_or_unavailable',
      'This Steam wishlist is private, empty, or unavailable.',
    );
  }

  return { steamId64, wishlistUrl, games };
}

async function fetchText(
  url: string,
  options: { fetcher?: FetchLike; timeoutMs?: number },
): Promise<string> {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new SteamWishlistError('fetch_failed', `Steam returned HTTP ${response.status}.`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof SteamWishlistError) {
      throw error;
    }

    throw new SteamWishlistError('fetch_failed', 'Could not fetch Steam wishlist.', error);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseWishlistApiJson(json: string): SteamWishlistGame[] {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch (error) {
    throw new SteamWishlistError('wishlist_parse_failed', 'Could not parse Steam wishlist API response.', error);
  }

  const response = payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>).response
    : null;
  const items = response && typeof response === 'object'
    ? (response as Record<string, unknown>).items
    : null;

  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const appId = readString(item as Record<string, unknown>, 'appid');
    if (!appId) {
      return [];
    }

    return [{
      appId,
      name: `Steam app ${appId}`,
      releaseDateText: null,
      storeUrl: `https://store.steampowered.com/app/${appId}/`,
    }];
  });
}

export function parseWishlistHtml(html: string): SteamWishlistGame[] {
  const legacyData = parseLegacyWishlistData(html);
  if (legacyData) {
    return legacyData;
  }

  const storeItemData = parseStoreItemDataSet(html);
  if (storeItemData) {
    return storeItemData;
  }

  if (html.includes('"error":"RateLimit"') || /<title>Wishlist - Error<\/title>/i.test(html)) {
    throw new SteamWishlistError('wishlist_rate_limited', 'Steam rate limited this wishlist request.');
  }

  if (/<title>Welcome to Steam<\/title>/i.test(html)) {
    throw new SteamWishlistError('wishlist_private_or_unavailable', 'Steam returned a welcome page instead of wishlist data.');
  }

  throw new SteamWishlistError('wishlist_parse_failed', 'Could not find wishlist data in Steam page.');
}

function parseLegacyWishlistData(html: string): SteamWishlistGame[] | null {
  const match = html.match(/g_rgWishlistData\s*=\s*(\[.*?\]);\s*\n/s);
  if (!match) {
    return null;
  }

  let rawGames: unknown;
  try {
    rawGames = JSON.parse(match[1]);
  } catch (error) {
    throw new SteamWishlistError('wishlist_parse_failed', 'Could not parse wishlist data from Steam page.', error);
  }

  if (!Array.isArray(rawGames)) {
    throw new SteamWishlistError('wishlist_parse_failed', 'Wishlist data had an unexpected shape.');
  }

  return rawGames
    .map((rawGame) => normalizeWishlistGame(rawGame))
    .filter((game): game is SteamWishlistGame => game !== null);
}

function parseStoreItemDataSet(html: string): SteamWishlistGame[] | null {
  const marker = 'GStoreItemData.AddStoreItemDataSet(';
  const start = html.indexOf(marker);
  if (start === -1) {
    return null;
  }

  const jsonStart = html.indexOf('{', start);
  if (jsonStart === -1) {
    return null;
  }

  const jsonText = readBalancedJsonObject(html, jsonStart);
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (error) {
    throw new SteamWishlistError('wishlist_parse_failed', 'Could not parse Steam store item data.', error);
  }

  if (!data || typeof data !== 'object') {
    throw new SteamWishlistError('wishlist_parse_failed', 'Steam store item data had an unexpected shape.');
  }

  const apps = (data as { rgApps?: unknown }).rgApps;
  if (!apps || typeof apps !== 'object') {
    throw new SteamWishlistError('wishlist_parse_failed', 'Steam store item data did not include rgApps.');
  }

  return Object.entries(apps).map(([appId, rawGame]) => normalizeStoreItemGame(appId, rawGame));
}

function readBalancedJsonObject(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  throw new SteamWishlistError('wishlist_parse_failed', 'Could not read complete Steam store item data.');
}

function normalizeStoreItemGame(appId: string, rawGame: unknown): SteamWishlistGame {
  const game = rawGame && typeof rawGame === 'object' ? (rawGame as Record<string, unknown>) : {};
  const name = readString(game, 'name') ?? `Steam app ${appId}`;
  const releaseDateText = readReleaseDate(game);

  return {
    appId,
    name,
    releaseDateText,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
  };
}

function normalizeWishlistGame(rawGame: unknown): SteamWishlistGame | null {
  if (!rawGame || typeof rawGame !== 'object') {
    return null;
  }

  const game = rawGame as Record<string, unknown>;
  const appId = readString(game, 'appid') ?? readString(game, 'app_id') ?? readString(game, 'id');
  const name = readString(game, 'name') ?? readString(game, 'title');
  const releaseDateText = readReleaseDate(game);

  if (!appId || !name) {
    return null;
  }

  return {
    appId,
    name,
    releaseDateText,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
  };
}

function readReleaseDate(game: Record<string, unknown>): string | null {
  const direct = readString(game, 'release_date') ?? readString(game, 'release_string');
  if (direct) {
    return direct;
  }

  const nested = game.release_date;
  if (nested && typeof nested === 'object') {
    return readString(nested as Record<string, unknown>, 'date');
  }

  return null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}
