# Current Status

Last updated: 2026-05-25

## Product

The product direction has moved from "wishlist releases only" to **Steam to Calendar**:

1. Show an immediately useful calendar even when the user has not provided an account.
2. Include Steam sale/festival events, current hot discounts, and preorders by default.
3. Let users tune what appears in the calendar: deal count, official event types, date range, store region, language, manual watched games, and wishlist import.
4. Generate a dynamic calendar feed whose settings and Steam language are encoded in the URL query string.
5. Make it clear that the feed can be subscribed to from the user's OS calendar apps through `webcal://` or copied HTTPS feed URLs.

The product positioning remains calendar-first: track Steam deals, game launch dates, and events in the user's system calendar. The app is not trying to become a full Steam database.

## Implementation

The app is a Next.js App Router project deployed to Vercel.

Key routes:

- `/` — Steam-styled configuration UI, region selector, game search/watch controls, subscription controls, and vertical calendar preview.
- `/api/public-preview` — loads account-free preview events from Steam CLI based on query settings.
- `/api/preview` — validates wishlist input, fetches Steam data, returns preview JSON.
- `/api/search-games` — searches Steam apps through Steam CLI.
- `/feed/[steamId64].ics` — returns `text/calendar` ICS feed.
- `/cal/[steamId64]` — extensionless calendar route for `webcal://` subscription links.

Key modules:

- `src/lib/steam/client.ts` — SteamID validation, numeric/custom Steam URL parsing, wishlist service fetch, app details fetch, timeout/cache helpers.
- `src/lib/steam/cli.ts` — `steam-cli --json` adapter with optional process-local TTL caching.
- `src/lib/steam/cache.ts` — in-memory cache with in-flight request deduplication.
- `src/lib/steam/cache-policy.ts` — TTL policy for deals, events, media, search, watched apps, and wishlist imports.
- `src/lib/steam/deals.ts` — top discounted/preorder event loading and media enrichment.
- `src/lib/steam/events.ts` — official Steam event loading through `steam-cli events --json`, category filtering, and static fallback.
- `src/lib/steam/search.ts` — Steam game search through `steam-cli search --json`.
- `src/lib/steam/search.ts` also accepts direct Steam appIDs and Steam store app URLs, then resolves them through `steam-cli app --json`.
- `src/lib/steam/watched-games.ts` — manual watched app events from `steam-cli app --json`.
- `src/lib/steam/regions.ts` — Steam store regions and flag labels.
- `src/lib/steam/pipeline.ts` — wishlist appID import plus app detail hydration.
- `src/lib/calendar-config.ts` — query/body calendar setting parsing and serialization.
- `src/lib/events/mapper.ts` — exact release dates and major Steam events to internal calendar events.
- `src/lib/ics/generator.ts` — Apple Calendar-compatible ICS generation.
- `src/lib/calendar-response.ts` — shared feed response assembly and request logging.
- `scripts/build-steam-cli.mjs` — Vercel build helper that compiles the `vendor/steam-cli` submodule into `bin/steam-cli`.

## Current data behavior

Runtime data should prefer the bundled Steam CLI submodule:

```text
steam-cli deals --filter topsellers --any discounted,preorder --count {count} --json --cc {cc} --lang {lang} --ui-lang {uiLang}
steam-cli events --past-days {pastDays} --future-days {futureDays} --json --cc {cc} --lang {lang} --ui-lang {uiLang}
steam-cli search {query} --count 8 --json --cc {cc} --lang {lang} --ui-lang {uiLang}
steam-cli app {appId} --json --cc {cc} --lang {lang} --ui-lang {uiLang}
steam-cli media {appId} --json --cc {cc} --lang {lang} --ui-lang {uiLang}
steam-cli wishlist {profileOrSteamId} --count {limit} --json
```

Steam store country/region (`cc`) and language are separate concepts. The app can infer defaults from request/browser context, but the user can explicitly choose both from the top bar. Store country controls Steam prices and regional availability. Language currently supports English and Simplified Chinese, and controls both core UI copy and Steam CLI data language. Feed URLs include `lang` and `uiLang` so calendar refreshes keep the same Steam language assumptions.

Settings are encoded into URL query parameters in this first version:

```text
deals=1&events=1&eventTypes=seasonal,next_fest,fest,store_sale&wishlist=1&apps=264710&count=5&pastDays=0&futureDays=365&cc=US&lang=english&uiLang=en
```

Wishlist import still falls back to Steam's public wishlist service endpoint if the CLI is unavailable. The prototype only supports public wishlists.

For Vercel, the repo now includes `steam-cli` as a public HTTPS Git submodule at `vendor/steam-cli`. The normal `npm run build` flow compiles that source into `bin/steam-cli`, and `next.config.ts` includes the binary in server function traces. At runtime the adapter uses `STEAM_CLI_PATH` if present, otherwise it falls back to `bin/steam-cli`.

## Cache behavior

Steam CLI calls have process-local TTL caching with in-flight deduplication:

| Data | Default TTL |
|---|---:|
| top deals/preorders | 10 minutes |
| official events | 6 hours |
| media images | 24 hours |
| game search | 15 minutes |
| watched app details | 10 minutes |
| wishlist import | 5 minutes |

The cache can be tuned with `STEAM_CLI_*_CACHE_TTL_MS` environment variables and capped with `STEAM_CLI_CACHE_MAX_ENTRIES`. This is intentionally simple for the current Vercel deployment; it reduces duplicate warm-instance CLI work but is not a persistent cross-instance cache.

## UI behavior

- The first screen is the usable product, not a marketing landing page.
- The default preview has account-free calendar items.
- The top bar separates Steam store region from language selection.
- Calendar rows use a vertical, scroll-snapping layout.
- Days with many events can grow taller instead of hiding all context.
- Search, wishlist import, and preview refreshes show explicit loading states.
- Adding a watched game animates both the selected-game row and the new calendar event.
- Users can copy the HTTPS feed URL for Google Calendar/Outlook and use `webcal://` for Apple Calendar-style subscription.
- Event removal in the detail panel is labeled as preview hiding, because it does not mutate the subscribed feed configuration.
- Private/unavailable wishlist failures keep the user on useful paths: Steam events, search, appID, or store URL.
- Motion respects `prefers-reduced-motion`.

## Verification

Current checks pass:

```bash
npm test
npm run build
npm run test:e2e
```

Coverage includes:

- SteamID validation, numeric/custom Steam URL parsing, and wishlist service parsing.
- Steam app detail pipeline behavior.
- Steam CLI cache reuse and in-flight deduplication.
- Calendar config query parsing and serialization.
- Event mapping for exact dates, excluded ambiguous dates, and Steam major events.
- Watched game discount/release event mapping.
- ICS output shape, all-day date handling, and escaping.
- Browser preview flow with feed URL, query settings, manual watched-game add, and calendar UI animation hooks.

## Recent shipped changes

- Repositioned product around Steam sale/calendar value instead of wishlist-only releases.
- Redesigned the UI around a Steam-flavored vertical calendar editor.
- Added full Steam store region dropdown with flags.
- Added URL query encoded feed settings.
- Added official Steam event type filters.
- Added top deals/preorders, search, manual watched games, media images, and public wishlist integration from Steam CLI.
- Added loading states and add-to-calendar animations.
- Added Steam CLI result caching.

## Next useful work

- Add persisted short links/private feed tokens for long query configurations.
- Add editable short-link settings.
- Finish full Chinese/English coverage for all secondary copy.
- Consider a shared persistent cache if Steam CLI pressure becomes visible in production.
