import { describe, expect, it } from 'vitest';
import { normalizeCc, steamLocaleFromRequest } from '../locale';
import { countryFlag, STEAM_STORE_REGIONS, steamStoreRegionName } from '../regions';

describe('Steam store regions', () => {
  it('matches the Steam CLI region list used for store pricing', () => {
    expect(STEAM_STORE_REGIONS).toHaveLength(44);
    expect(STEAM_STORE_REGIONS.map((region) => region.code)).toContain('AE');
    expect(STEAM_STORE_REGIONS.map((region) => region.code)).toContain('HK');
  });

  it('normalizes supported Steam store country codes', () => {
    expect(normalizeCc('ae')).toBe('AE');
    expect(normalizeCc('UK')).toBe('GB');
    expect(normalizeCc('XX')).toBeNull();
  });

  it('renders country flags and names for the picker label', () => {
    expect(countryFlag('US')).toBe('🇺🇸');
    expect(countryFlag('GB')).toBe('🇬🇧');
    expect(steamStoreRegionName('JP')).toBe('Japan');
  });

  it('keeps explicit store country and language settings in feed URLs', () => {
    const request = new Request('https://example.test/feed/steam-events.ics?cc=JP&lang=japanese&uiLang=en', {
      headers: { 'accept-language': 'zh-CN,zh;q=0.9' },
    });

    expect(steamLocaleFromRequest(request)).toEqual({
      cc: 'JP',
      lang: 'japanese',
      uiLang: 'en',
    });
  });
});
