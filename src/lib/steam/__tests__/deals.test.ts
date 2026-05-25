import { describe, expect, it } from 'vitest';
import { selectSteamMediaImage } from '../deals';

describe('Steam deals media', () => {
  it('prefers wide Steam media assets for calendar detail artwork', () => {
    expect(
      selectSteamMediaImage({
        header_image: 'https://cdn.example.test/header.jpg',
        cdn_assets: [
          {
            kind: 'capsule',
            name: 'main_capsule',
            url: 'https://cdn.example.test/main-capsule.jpg',
          },
          {
            kind: 'library',
            name: 'library_hero',
            url: 'https://cdn.example.test/library-hero.jpg',
          },
        ],
      }),
    ).toBe('https://cdn.example.test/library-hero.jpg');
  });

  it('falls back to header_image when structured CDN assets are unavailable', () => {
    expect(
      selectSteamMediaImage({
        header_image: 'https://cdn.example.test/header.jpg',
        cdn_assets: [],
      }),
    ).toBe('https://cdn.example.test/header.jpg');
  });

  it('skips probed CDN assets that Steam reports as unavailable', () => {
    expect(
      selectSteamMediaImage({
        header_image: 'https://cdn.example.test/header.jpg',
        cdn_assets: [
          {
            available: false,
            kind: 'library',
            name: 'library_hero',
            status: 404,
            url: 'https://cdn.example.test/missing-library-hero.jpg',
          },
          {
            available: true,
            kind: 'capsule',
            name: 'main_capsule',
            status: 200,
            url: 'https://cdn.example.test/main-capsule.jpg',
          },
        ],
      }),
    ).toBe('https://cdn.example.test/main-capsule.jpg');
  });

  it('normalizes protocol-relative Steam media URLs', () => {
    expect(
      selectSteamMediaImage({
        cdn_assets: [
          {
            kind: 'library',
            name: 'library_hero',
            url: '//cdn.example.test/library-hero.jpg',
          },
        ],
      }),
    ).toBe('https://cdn.example.test/library-hero.jpg');
  });
});
