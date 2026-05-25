import { describe, expect, it } from 'vitest';
import { parseSteamAppInput } from '../search';

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
});
