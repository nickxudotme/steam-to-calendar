import { describe, expect, it } from 'vitest';
import { parseSteamAppInput, searchPriceFormatted } from '../search';

describe('Steam game search input parsing', () => {
  it('accepts app IDs and Steam store URLs as direct game inputs', () => {
    expect(parseSteamAppInput('264710')).toBe('264710');
    expect(parseSteamAppInput('https://store.steampowered.com/app/264710/Subnautica/')).toBe('264710');
    expect(parseSteamAppInput('https://store.steampowered.com/app/1962700?utm_source=calendar')).toBe('1962700');
  });

  it('ignores non-app search text and non-Steam URLs', () => {
    expect(parseSteamAppInput('subnautica')).toBeNull();
    expect(parseSteamAppInput('https://example.com/app/264710')).toBeNull();
  });

  it('formats numeric Steam search prices when formatted strings are missing', () => {
    expect(searchPriceFormatted('', 29800, 'CNY', 'zh-CN')).toBe('¥298.00');
    expect(searchPriceFormatted(undefined, 5999, 'USD', 'en')).toBe('$59.99');
  });

  it('prefers Steam formatted search prices when present', () => {
    expect(searchPriceFormatted('¥ 37.25', 3725, 'CNY', 'zh-CN')).toBe('¥ 37.25');
  });
});
