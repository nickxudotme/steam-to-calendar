<p align="center">
  <img src="public/assets/brand/steam-to-calendar-logo.png" alt="Steam to Calendar logo" width="96" height="96" />
</p>

<h1 align="center">Steam to Calendar</h1>

<p align="center">
  Track Steam deals, game launch dates, wishlist releases, and official Steam events in your calendar.
</p>

<p align="center">
  <a href="README.zh-CN.md">中文文档</a>
  ·
  <a href="https://github.com/nickxudotme/steam-cli">Steam CLI</a>
  ·
  <a href="https://isthereanydeal.com/apps/">Get an API key</a>
</p>

Steam to Calendar is a production-style Next.js app that turns public Steam data into a subscribable calendar feed. It helps you follow official Steam sale windows and festivals, track selected games, import a public Steam wishlist, and subscribe from Apple Calendar, Google Calendar, Outlook, Fantastical, or any calendar app that supports ICS/WebCal.

This project is built on top of [Steam CLI](https://github.com/nickxudotme/steam-cli), which is vendored as `vendor/steam-cli` and compiled into `bin/steam-cli` during production builds.

> Steam to Calendar is not affiliated with Valve Corp. Steam, Valve, and related marks belong to their respective owners.

## Product Tour

Desktop workbench:

![Steam to Calendar desktop calendar builder](public/assets/readme/calendar-builder-desktop.png)

Mobile calendar builder:

<p align="center">
  <img src="public/assets/readme/calendar-builder-mobile.png" alt="Steam to Calendar mobile calendar builder" width="320" />
</p>

## Features

- Subscribe to a generated calendar feed for Steam events, watched games, or a public wishlist.
- Track official Steam seasonal sales, Next Fest, theme fests, publisher sales, and franchise events.
- Import public Steam wishlists and turn upcoming releases, preorders, and discounts into calendar events.
- Search Steam games manually when you only want to follow a small watch list.
- Preview the calendar in a desktop/mobile workbench before subscribing.
- Choose Steam store region and interface language independently.
- Generate ICS/WebCal URLs that preserve feed configuration through query parameters.
- Use Steam-only data by default, with optional advanced price-history enrichment.

## Full Experience: API Key

The app works without any third-party API key. In that mode it uses public Steam data through Steam CLI and falls back gracefully when advanced pricing data is unavailable.

For the full experience, create an IsThereAnyDeal API key at <https://isthereanydeal.com/apps/> and set:

```bash
STEAM_CLI_ITAD_KEY=your_key
```

This enables advanced price-history features from Steam CLI, including richer historical low and price-window data. See the [Steam CLI README](https://github.com/nickxudotme/steam-cli#advanced-price-enhancement) for the underlying CLI behavior.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run build:steam-cli
npm run dev
```

`npm run dev` uses the webpack dev server. `npm run dev:turbopack` is available for checking Turbopack behavior, but webpack is the default local workflow for this app.

If local Next.js dev state gets strange, clear only the dev cache:

```bash
npm run dev:clean
```

Then open <http://localhost:3000>.

## Configuration

Common environment variables:

| Variable                            | Required | Description                                                                   |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `STEAM_CLI_PATH`                    | No       | Path to the Steam CLI binary. Defaults to `bin/steam-cli` when built locally. |
| `STEAM_CLI_ITAD_KEY`                | No       | Optional IsThereAnyDeal API key for advanced price-history enrichment.        |
| `STEAM_CLI_CC`                      | No       | Default Steam store country/region code, such as `US`, `CN`, or `JP`.         |
| `STEAM_CLI_LANG`                    | No       | Default Steam content language, such as `english` or `schinese`.              |
| `STEAM_CLI_UI_LANG`                 | No       | Default Steam CLI interface language, such as `en` or `zh-CN`.                |
| `STEAM_CLI_CACHE_MAX_ENTRIES`       | No       | Maximum in-memory Steam CLI cache entries.                                    |
| `STEAM_CLI_CACHE_STALE_TTL_MS`      | No       | How long stale successful CLI responses may be reused after refresh failures. |
| `STEAM_CALENDAR_WATCHED_APP_BUDGET` | No       | Maximum watched-app lookups per calendar request.                             |

See [.env.example](.env.example) for the full local-development template.

## Scripts

```bash
npm run dev              # Start Next.js with webpack
npm run dev:clean        # Clear .next/dev
npm run build:steam-cli  # Build vendor/steam-cli into bin/steam-cli
npm run build            # Production build; builds Steam CLI first
npm run start            # Start the production server
npm run verify           # Format, lint, typecheck, unit tests, build
npm run verify:full      # verify + stable Playwright e2e
npm run test:e2e:live    # Live Steam smoke tests
```

Production builds run `build:steam-cli` automatically. If you intentionally want to skip rebuilding the binary during local checks, set:

```bash
SKIP_STEAM_CLI_BUILD=1 npm run build
```

## Project Structure

```text
src/
  app/                  Thin App Router pages and route handlers
  features/             User-facing workflows and UI
  domain/               Framework-light calendar rules and ICS mapping
  integrations/         Steam CLI/API adapters, parsing, cache, fallbacks
  server/               HTTP/API response orchestration
  shared/               Browser/server contracts and validators

vendor/steam-cli/       Steam CLI submodule
public/assets/brand/    Logo and app icons
```

Architecture boundaries:

- `src/app` should stay thin: route handlers, layouts, and page shells.
- `src/features/calendar-builder` owns the interactive calendar builder UI.
- `src/domain/calendar` owns feed configuration, calendar event mapping, and ICS output.
- `src/integrations/steam` owns Steam CLI/API details and Steam-specific parsing.
- `src/server/calendar` owns request-level calendar orchestration and HTTP responses.
- `src/shared` owns DTOs and runtime validators shared across server and browser code.

## Testing

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

For full confidence:

```bash
npm run verify:full
```

Testing approach:

- Unit tests cover calendar mapping, ICS generation, Steam parsing, cache behavior, route contracts, and response builders.
- Default Playwright tests use mocked Steam responses so CI remains deterministic.
- Live Steam smoke tests are separate because real Steam data and network state can change:

```bash
npm run test:e2e:live
```

## Data Sources

Steam to Calendar uses the vendored [Steam CLI](https://github.com/nickxudotme/steam-cli) for most Steam access. Steam CLI combines public Steam Store, Steam Community, Steam Web API, Steamworks event pages, and optional IsThereAnyDeal enrichment.

Default mode is public, live, and API-key-free. Optional advanced pricing requires `STEAM_CLI_ITAD_KEY`.

## Contributing

Issues and pull requests are welcome. Before opening a PR, run:

```bash
npm run verify
```

For UI changes, also run the relevant Playwright tests and manually check both desktop and mobile layouts.
