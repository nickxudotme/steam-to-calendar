import { mapSteamDealEvents, type CalendarEvent, type SteamDealItem } from '@/lib/events/mapper';
import { runSteamCliJson } from '@/lib/steam/cli';

export type SteamMediaAsset = {
  kind?: string;
  name: string;
  url: string;
};

export type SteamMedia = {
  header_image?: string;
  cdn_assets?: SteamMediaAsset[];
};

const MEDIA_CONCURRENCY = 3;
const MEDIA_IMAGE_PRIORITY = [
  'library_hero_2x',
  'library_hero',
  'hero_capsule_2x',
  'hero_capsule',
  'main_capsule_2x',
  'main_capsule',
  'header_2x',
  'header',
];

export async function fetchSteamDealEvents(
  options: { cc?: string; count?: number; lang?: string; uiLang?: string } = {},
): Promise<CalendarEvent[]> {
  const count = options.count ?? 5;
  const data = await runSteamCliJson<SteamDealItem[]>([
    'deals',
    '--filter',
    'topsellers',
    '--any',
    'discounted,preorder',
    '--count',
    String(count),
  ], { cc: options.cc, lang: options.lang, uiLang: options.uiLang });

  if (!data) {
    return [];
  }

  return mapSteamDealEvents(await enrichSteamDealMedia(data, options));
}

async function enrichSteamDealMedia(
  deals: SteamDealItem[],
  options: { cc?: string; lang?: string; uiLang?: string },
): Promise<SteamDealItem[]> {
  return mapWithConcurrency(deals, MEDIA_CONCURRENCY, async (deal) => {
    const media = await fetchSteamMedia(deal.appid, options);
    const imageUrl = media ? selectSteamMediaImage(media) : undefined;

    return imageUrl ? { ...deal, image_url: imageUrl } : deal;
  });
}

async function fetchSteamMedia(
  appId: number,
  options: { cc?: string; lang?: string; uiLang?: string },
): Promise<SteamMedia | null> {
  try {
    return await runSteamCliJson<SteamMedia>([
      'media',
      String(appId),
    ], {
      cc: options.cc,
      lang: options.lang,
      processTimeoutMs: 20_000,
      uiLang: options.uiLang,
    });
  } catch {
    return null;
  }
}

export function selectSteamMediaImage(media: SteamMedia): string | undefined {
  const assetsByName = new Map(
    (media.cdn_assets ?? [])
      .filter((asset) => asset.url)
      .map((asset) => [asset.name, asset.url]),
  );

  for (const assetName of MEDIA_IMAGE_PRIORITY) {
    const url = assetsByName.get(assetName);

    if (url) {
      return url;
    }
  }

  return media.header_image;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}
