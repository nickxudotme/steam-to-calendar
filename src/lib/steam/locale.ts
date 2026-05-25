import { STEAM_STORE_REGION_CODES } from '@/lib/steam/regions';

export type SteamLocaleOptions = {
  cc: string;
  lang: string;
  uiLang: string;
};

export function steamLocaleFromRequest(request: Request): SteamLocaleOptions {
  const url = new URL(request.url);
  const explicitCc = normalizeCc(url.searchParams.get('cc'));
  const explicitLang = normalizeSteamLang(url.searchParams.get('lang'));
  const explicitUiLang = normalizeUiLang(url.searchParams.get('uiLang'));
  const headerCc = normalizeCc(
    request.headers.get('x-vercel-ip-country')
      || request.headers.get('cf-ipcountry')
      || request.headers.get('x-country-code'),
  );
  const acceptLanguage = request.headers.get('accept-language') || '';

  return {
    cc: explicitCc || headerCc || 'US',
    lang: explicitLang || steamLangFromAcceptLanguage(acceptLanguage),
    uiLang: explicitUiLang || (acceptLanguage.toLowerCase().includes('zh') ? 'zh-CN' : 'en'),
  };
}

export function normalizeCc(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const cc = value.trim().toUpperCase();
  if (cc === 'UK') {
    return 'GB';
  }

  if (!/^[A-Z]{2}$/.test(cc) || cc === 'XX' || cc === 'T1') {
    return null;
  }

  return STEAM_STORE_REGION_CODES.has(cc) ? cc : null;
}

function steamLangFromAcceptLanguage(value: string): string {
  const lower = value.toLowerCase();

  if (lower.includes('zh-tw') || lower.includes('zh-hk')) {
    return 'tchinese';
  }

  if (lower.includes('zh')) {
    return 'schinese';
  }

  if (lower.includes('ja')) {
    return 'japanese';
  }

  if (lower.includes('ko')) {
    return 'koreana';
  }

  if (lower.includes('pt-br')) {
    return 'brazilian';
  }

  if (lower.includes('es-419') || lower.includes('es-mx')) {
    return 'latam';
  }

  return 'english';
}

function normalizeSteamLang(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const lang = value.trim().toLowerCase();
  const allowed = new Set([
    'arabic',
    'brazilian',
    'bulgarian',
    'czech',
    'danish',
    'dutch',
    'english',
    'finnish',
    'french',
    'german',
    'greek',
    'hungarian',
    'indonesian',
    'italian',
    'japanese',
    'koreana',
    'latam',
    'norwegian',
    'polish',
    'portuguese',
    'romanian',
    'russian',
    'schinese',
    'spanish',
    'swedish',
    'tchinese',
    'thai',
    'turkish',
    'ukrainian',
    'vietnamese',
  ]);

  return allowed.has(lang) ? lang : null;
}

function normalizeUiLang(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const lang = value.trim();
  if (/^zh(-CN)?$/i.test(lang)) {
    return 'zh-CN';
  }

  if (/^en(-US)?$/i.test(lang)) {
    return 'en';
  }

  return null;
}
