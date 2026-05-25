# Steam Sale Calendar

Put Steam sales, fests, hot deals, preorders, and watched games into the calendar you actually live in.

Steam Sale Calendar is a Next.js app that builds a subscribable OS calendar from Steam data. It can show official Steam sale/festival events, current top discounted or preorder games, manually watched games, and public wishlist releases. The UI previews the feed as a vertical calendar, then exposes both an HTTPS `.ics` URL and a `webcal://` subscription URL for Apple Calendar, Google Calendar, Outlook, Fantastical, and other calendar apps.

Live prototype:

```text
https://wishlist-in-calender.vercel.app/
```

## What works now

- Calendar-first UI with a scroll-snapping vertical calendar preview.
- Steam store country/region selection with flags, aligned to Steam price regions.
- Language selection for UI copy and Steam CLI data language.
- URL-encoded feed settings for the first version: deals, events, event categories, wishlist, watched app IDs, count, date range, and store region.
- Official Steam event import from `steam-cli events --json`, including event category filtering.
- Hot deals and preorders from `steam-cli deals --filter topsellers --any discounted,preorder --json`.
- Steam game search through `steam-cli search --json`.
- Manual game watching through search, Steam appID, or Steam store URL, backed by `steam-cli app --json`.
- Steam media-backed images through `steam-cli media --json`; runtime images should come from Steam CLI data, not local generated placeholders.
- Public wishlist import through `steam-cli wishlist --json`, with Steam's wishlist service endpoint as a fallback.
- Loading states for preview/search/wishlist import, plus add-to-calendar animations for newly watched games.
- In-memory TTL caching around Steam CLI JSON calls, including in-flight request deduplication.
- SteamID64 input, plus numeric and custom Steam profile/wishlist URL parsing for wishlist import.
- Copyable `.ics` feed URL.
- One-click `webcal://` subscription route, plus an HTTPS feed URL for Google Calendar and Outlook.
- Apple Calendar-compatible ICS response headers and event shape.
- Unit tests for Steam ingestion, event mapping, and ICS generation.
- Playwright coverage for preview and feed subscription UI.

## Run locally

```bash
npm install
npm run dev
```

The default local setup builds and uses the bundled CLI at `bin/steam-cli`:

```bash
npm run build:steam-cli
STEAM_CLI_PATH=bin/steam-cli
```

See `.env.example` for optional locale and timeout settings. The default adapter forces English Steam date strings so the calendar parser can reliably detect exact release dates.

## Feed configuration

The current version stores configuration directly in the feed URL query string. This keeps the product account-free while making feeds reproducible and subscribable.

Supported query parameters:

- `deals=1|0` — include current hot discounts and preorders.
- `events=1|0` — include official Steam sale/festival events.
- `eventTypes=seasonal,next_fest,fest,store_sale` — filter Steam event categories.
- `wishlist=1|0` — include public wishlist release events when the feed belongs to a wishlist.
- `apps=264710,1962700` — manually watched Steam app IDs.
- `count=5` — number of top deals/preorders to show.
- `pastDays=0` and `futureDays=365` — event date window passed through to Steam CLI.
- `cc=US` — Steam store country/region for pricing and store data.
- `lang=english` and `uiLang=en` — Steam data/UI language fixed when the feed URL is generated. The language picker currently supports English and Simplified Chinese.

Later versions can replace these long query strings with editable short links or private feed tokens.

## Steam CLI data and cache

All product data should come from the bundled `steam-cli` submodule when possible. The app shells out with `--json` and keeps route handlers thin.

Default cache TTLs:

- deals: 10 minutes
- events: 6 hours
- media: 24 hours
- search: 15 minutes
- watched app details: 10 minutes
- wishlist: 5 minutes

Environment overrides:

```bash
STEAM_CLI_DEALS_CACHE_TTL_MS=600000
STEAM_CLI_EVENTS_CACHE_TTL_MS=21600000
STEAM_CLI_MEDIA_CACHE_TTL_MS=86400000
STEAM_CLI_SEARCH_CACHE_TTL_MS=900000
STEAM_CLI_APP_CACHE_TTL_MS=600000
STEAM_CLI_WISHLIST_CACHE_TTL_MS=300000
STEAM_CLI_CACHE_MAX_ENTRIES=250
```

Set a TTL to `0` to disable that cache. The cache is process-local, so on Vercel it applies per warm server instance rather than across all instances.

## Vercel deployment

`steam-cli` is included as a Git submodule under `vendor/steam-cli`. Vercel can deploy this through the normal Git flow:

1. Push this repo and its submodule pointer.
2. Vercel clones the repo and public HTTPS submodule.
3. `npm run build` runs `prebuild`, which compiles `vendor/steam-cli` into `bin/steam-cli`.
4. Next.js includes `bin/steam-cli` in server function traces through `outputFileTracingIncludes`.
5. Runtime code finds `bin/steam-cli` automatically when `STEAM_CLI_PATH` is not set.

The submodule points at a specific `steam-cli` commit. After changing `steam-cli`, commit and push that repo first, then update the submodule pointer in this repo:

```bash
git submodule update --remote vendor/steam-cli
git add vendor/steam-cli
git commit -m "Update steam-cli"
```

Open:

```text
http://localhost:3000
```

Sample SteamID64 or supported profile URL:

```text
76561198115468824
https://steamcommunity.com/profiles/76561198115468824/
https://steamcommunity.com/id/nickxudotme/
https://store.steampowered.com/wishlist/profiles/76561198115468824/
```

## Calendar routes

The direct ICS route is:

```text
http://localhost:3000/feed/{steamId64}.ics
```

The one-click subscription route is extensionless:

```text
webcal://localhost:3000/cal/{steamId64}
```

For the sample:

```text
http://localhost:3000/feed/76561198115468824.ics
webcal://localhost:3000/cal/76561198115468824
```

Apple Calendar may reject local `webcal://localhost:3000` subscriptions. For local testing, paste the HTTP feed URL into Apple Calendar with `File -> New Calendar Subscription`. The deployed Vercel URL is the better end-to-end subscription target.

## Project docs

- [Current status](docs/current-status.md)
- [Product design](docs/product-design.md)
- [Engineering plan](docs/engineering-plan.md)
- [Test plan](docs/test-plan.md)
- [Asset inventory](docs/assets.md)

## Scope

In scope for the current prototype:

- Account-free Steam sale calendar subscription.
- Official Steam sale/festival events.
- Current hot discounts and preorders.
- Manual watched games and public wishlist releases.
- Steam store country/region configuration.
- URL query encoded settings.
- Local bundled `steam-cli` data adapter.
- Dynamic `.ics` feed generated on request.
- Local and deployed calendar subscription validation.

Intentionally out of scope for now:

- Steam login.
- Accounts or saved user settings.
- Share pages.
- Donation flow.
- Historical lows.
- Persisted short-link editing.
- Cross-instance persistent data cache.

## Verify

```bash
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
```
