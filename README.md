# Wishlist in Calendar

Put your Steam wishlist into the calendar you actually live in.

Wishlist in Calendar is a small Next.js prototype that turns a public Steam wishlist into a subscribable calendar feed. It previews future Steam moments in a simulated calendar app, then exposes both an HTTPS `.ics` URL and an extensionless `webcal://` subscription URL for calendar apps.

Live prototype:

```text
https://wishlist-in-calender.vercel.app/
```

## What works now

- SteamID64 input.
- Optional `steam-cli --json` integration for wishlist import, app details, and official Steam events.
- Public wishlist import through Steam's wishlist service endpoint as a fallback.
- Steam app detail lookup for wishlist appIDs.
- Future exact release dates mapped to all-day calendar events.
- Official Steam events from `steam-cli events --json`, with a small fixed seed fallback.
- Simulated monthly calendar preview with an agenda list.
- Copyable `.ics` feed URL.
- One-click `webcal://` subscription route.
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

Sample SteamID64:

```text
76561198115468824
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

- SteamID64 only.
- Public wishlist only.
- Future exact release dates only.
- Major Steam events seed.
- Optional local `steam-cli` data adapter.
- Dynamic `.ics` feed generated on request.
- Local and deployed Apple Calendar validation.

Intentionally out of scope for now:

- Steam login.
- Vanity profile URLs.
- Accounts or saved user settings.
- Share pages.
- Donation flow.
- Historical lows.
- Per-game discount events.
- Full Steam search.

## Verify

```bash
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
```
