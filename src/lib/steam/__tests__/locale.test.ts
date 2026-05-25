import { describe, expect, it } from 'vitest';
import { normalizeCc } from '../locale';
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
});
