# Steam to Calendar

Track Steam deals, game launch dates, and events in your calendar.

Steam to Calendar is a Next.js app that builds a subscribable OS calendar from
Steam data. It can show official Steam sale/festival events, current top
discounted or preorder games, manually watched games, and public wishlist
releases.

The codebase is organized as a production-style Next.js project: thin routes,
shared API contracts, isolated Steam integration adapters, focused feature
components, and repeatable quality gates.

## Run Locally

```bash
npm install
npm run dev
```

`npm run dev` uses the webpack dev server because the current Next.js 16
Turbopack dev server can repeatedly reload this app after HMR panics. Use
`npm run dev:turbopack` only when intentionally checking whether that upstream
behavior has improved. If local dev state gets strange, clear only the Next
dev cache:

```bash
npm run dev:clean
```

The default setup builds and uses the bundled CLI at `bin/steam-cli`:

```bash
npm run build:steam-cli
STEAM_CLI_PATH=bin/steam-cli
```

Production builds run `build:steam-cli` automatically. For local checks that do
not need the binary rebuild, set `SKIP_STEAM_CLI_BUILD=1` before `npm run build`.

## Project Structure

```text
src/
  app/                  Next.js route handlers and route shells only
  features/             User-facing product workflows and UI
  domain/               Framework-light business types and mapping rules
  integrations/         External system adapters, clients, cache, parsing
  server/               Server-side application orchestration
  shared/               Browser/server DTOs and cross-boundary contracts
```

Current boundaries:

- `src/app` should stay thin: route handlers, layouts, and page shells.
- `src/features/calendar-builder` owns the interactive calendar builder UI.
- `src/domain/calendar` owns feed configuration, calendar event mapping, and ICS output.
- `src/integrations/steam` owns Steam CLI/API details and Steam-specific parsing.
- `src/server/calendar` owns request-level calendar orchestration and HTTP responses.
- `src/shared` owns types that must stay identical across route handlers and browser code.

## Verify

```bash
npm run verify
npm run verify:full
```

`verify` runs format, lint, typecheck, unit tests, and production build.
`verify:full` adds the stable Playwright suite. Live Steam smoke tests are
kept separate because they depend on external network state:

```bash
npm run test:e2e:live
```

## Testing Strategy

- Unit tests cover domain mapping, ICS generation, Steam adapter parsing, cache behavior, and server response builders.
- Default Playwright tests use mocked Steam responses so CI and workshops stay deterministic.
- `@steam-live` Playwright tests exercise real Steam connectivity and should be treated as smoke/manual checks.

## Steam CLI

The project vendors the Steam CLI source as `vendor/steam-cli` and builds a
local binary into `bin/steam-cli`. Generated binaries are ignored by git.

Useful runtime knobs:

- `STEAM_CLI_CACHE_MAX_ENTRIES` caps in-memory CLI cache entries.
- `STEAM_CLI_CACHE_STALE_TTL_MS` controls how long expired successful CLI
  responses can be used when a refresh fails.
- `STEAM_CALENDAR_WATCHED_APP_BUDGET` caps watched-app lookups per calendar
  request.
