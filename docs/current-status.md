# Current Status

Last updated: 2026-05-21

## Product

Wishlist in Calendar now proves the core loop:

1. Enter a SteamID64.
2. Import the user's public Steam wishlist.
3. Preview subscribed moments in a simulated monthly calendar.
4. Generate a dynamic calendar feed.
5. Subscribe through `webcal://` or copy the HTTPS `.ics` URL.

The product positioning remains calendar-first: this is not a Steam database, discount site, or game news site. It is a quiet timeline layer for releases and Steam seasons.

## Implementation

The app is a Next.js App Router project deployed to Vercel.

Key routes:

- `/` — SteamID64 input, subscription controls, simulated calendar preview.
- `/api/preview` — validates input, fetches Steam data, returns preview JSON.
- `/feed/[steamId64].ics` — returns `text/calendar` ICS feed.
- `/cal/[steamId64]` — extensionless calendar route for `webcal://` subscription links.

Key modules:

- `src/lib/steam/client.ts` — SteamID validation, wishlist service fetch, app details fetch, timeout/cache helpers.
- `src/lib/steam/pipeline.ts` — wishlist appID import plus app detail hydration.
- `src/lib/events/mapper.ts` — exact release dates and major Steam events to internal calendar events.
- `src/lib/ics/generator.ts` — Apple Calendar-compatible ICS generation.
- `src/lib/calendar-response.ts` — shared feed response assembly and request logging.

## Current data behavior

Wishlist import uses:

```text
https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid={steamId64}
```

This avoids the earlier HTML parsing issue where Steam redirects could expose unrelated storefront data. The prototype still only supports public wishlists.

For SteamID64 `76561198115468824`, the current public wishlist import returns 11 wishlist appIDs. As of 2026-05-21, none of those games have future exact release dates, so the preview shows 0 wishlist release events and keeps the major Steam events visible.

## Verification

Current checks pass:

```bash
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
```

Coverage includes:

- SteamID validation and wishlist service parsing.
- Steam app detail pipeline behavior.
- Event mapping for exact dates, excluded ambiguous dates, and Steam major events.
- ICS output shape, all-day date handling, and escaping.
- Browser preview flow with feed URL and simulated calendar UI.

## Recent shipped changes

- Switched wishlist import to Steam's wishlist service endpoint.
- Added `/cal/[steamId64]` for extensionless `webcal://` subscriptions.
- Tuned ICS response shape for Apple Calendar compatibility.
- Added request logging around calendar feed requests.
- Rebuilt the front end around a simulated calendar app preview.
- Pushed the project to GitHub and deployed it on Vercel.

## Next useful work

- Add Steam profile URL parsing for the exact numeric profile form.
- Add a manual Steam appID/store URL add flow for private wishlists.
- Add persisted private feed tokens before supporting settings.
- Add bilingual zh/en routing and copy.
- Add richer Steam events maintenance once the core subscription flow is stable.
