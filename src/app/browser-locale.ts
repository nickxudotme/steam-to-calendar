import { STEAM_STORE_REGION_CODES } from '@/lib/steam/regions';
import { LANGUAGE_OPTIONS, type LanguageOption } from './ui-copy';

export function languageOptionByCode(code: string): LanguageOption {
  return LANGUAGE_OPTIONS.find((language) => language.code === code) ?? LANGUAGE_OPTIONS[0];
}

export function languageCodeFromBrowser(language: string): LanguageOption {
  const lower = language.toLowerCase();

  if (lower.startsWith('zh')) {
    return languageOptionByCode('zh-CN');
  }

  return languageOptionByCode('en');
}

export function storeRegionFromBrowser(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const timeZoneRegion = storeRegionFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

  if (timeZoneRegion) {
    return timeZoneRegion;
  }

  return storeRegionFromLanguages(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

function storeRegionFromTimeZone(timeZone?: string): string | null {
  if (!timeZone) {
    return null;
  }

  const timeZoneToRegion: Record<string, string> = {
    'Asia/Shanghai': 'CN',
    'Asia/Hong_Kong': 'HK',
    'Asia/Taipei': 'TW',
    'Asia/Tokyo': 'JP',
    'Asia/Seoul': 'KR',
    'Asia/Singapore': 'SG',
    'Asia/Bangkok': 'TH',
    'Asia/Ho_Chi_Minh': 'VN',
    'Asia/Jakarta': 'ID',
    'Asia/Kuala_Lumpur': 'MY',
    'Asia/Manila': 'PH',
    'Asia/Kolkata': 'IN',
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Brisbane': 'AU',
    'Australia/Perth': 'AU',
    'Pacific/Auckland': 'NZ',
    'Europe/London': 'GB',
    'Europe/Berlin': 'DE',
    'Europe/Paris': 'FR',
    'Europe/Rome': 'IT',
    'Europe/Madrid': 'ES',
    'Europe/Amsterdam': 'NL',
    'Europe/Brussels': 'BE',
    'Europe/Vienna': 'AT',
    'Europe/Zurich': 'CH',
    'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO',
    'Europe/Copenhagen': 'DK',
    'Europe/Helsinki': 'FI',
    'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ',
    'Europe/Budapest': 'HU',
    'Europe/Bucharest': 'RO',
    'Europe/Istanbul': 'TR',
    'Europe/Kyiv': 'UA',
    'America/Sao_Paulo': 'BR',
    'America/Mexico_City': 'MX',
    'America/Argentina/Buenos_Aires': 'AR',
    'America/Santiago': 'CL',
    'America/Bogota': 'CO',
    'America/Lima': 'PE',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Montreal': 'CA',
    'Africa/Johannesburg': 'ZA',
    'Asia/Riyadh': 'SA',
    'Asia/Dubai': 'AE',
  };

  if (timeZoneToRegion[timeZone]) {
    return normalizeBrowserStoreRegion(timeZoneToRegion[timeZone]);
  }

  if (timeZone.startsWith('America/')) {
    return 'US';
  }

  return null;
}

function storeRegionFromLanguages(languages: readonly string[]): string | null {
  for (const language of languages) {
    const regionMatch = language.match(/[-_]([a-z]{2})\b/i);
    const explicitRegion = normalizeBrowserStoreRegion(regionMatch?.[1]);

    if (explicitRegion) {
      return explicitRegion;
    }

    const lower = language.toLowerCase();

    if (lower.startsWith('zh-hk')) {
      return 'HK';
    }

    if (lower.startsWith('zh-tw') || lower.startsWith('zh-hant')) {
      return 'TW';
    }

    if (lower.startsWith('zh')) {
      return 'CN';
    }

    if (lower.startsWith('ja')) {
      return 'JP';
    }

    if (lower.startsWith('ko')) {
      return 'KR';
    }
  }

  return null;
}

function normalizeBrowserStoreRegion(region?: string): string | null {
  if (!region) {
    return null;
  }

  const upperRegion = region.toUpperCase();

  return STEAM_STORE_REGION_CODES.has(upperRegion) ? upperRegion : null;
}

export function shouldSendClientStoreRegion(hostname: string): boolean {
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.startsWith('192.168.');
}
