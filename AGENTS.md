# Steam to Calendar Agent Guide

This repo is the rebuilt `Steam to Calendar` product. Treat it as a production-style
Next.js app, not as the old `wishlist-in-calender` prototype.

## Next.js Version

This project uses Next.js 16. APIs, conventions, route behavior, and generated files
may differ from older training data. When behavior is unclear, check the installed
docs under `node_modules/next/dist/docs/` before changing framework code.

## Architecture

Keep the layer boundaries clean:

- `src/app` contains thin App Router pages and route handlers only.
- `src/features/calendar-builder` owns the browser UI and user workflows.
- `src/domain/calendar` owns framework-light calendar config, event mapping, and ICS generation.
- `src/integrations/steam` owns Steam CLI/API calls, caching, parsing, and fallbacks.
- `src/server/calendar` composes domain and integration code for HTTP/API responses.
- `src/shared` contains browser/server DTOs, runtime validators, and shared constants.

Do not reintroduce the old `src/lib` catch-all structure. If code crosses layers, move
the shared contract into `src/shared` or keep Steam-specific details inside
`src/integrations/steam`.

## Steam CLI

The Steam CLI is vendored as the `vendor/steam-cli` submodule and built into
`bin/steam-cli` by `npm run build:steam-cli`.

Important environment variables:

- `STEAM_CLI_PATH=bin/steam-cli` can override the binary path.
- `STEAM_CLI_ITAD_KEY` enables advanced price-history windows.
- Never expose Steam tokens through `NEXT_PUBLIC_*`.

Price history is progressive enhancement. If history lookup fails, the app should fall
back to current Steam store data and continue generating previews and ICS feeds.

## Quality Gates

Before landing meaningful changes, run the relevant checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

For full confidence, run:

```bash
npm run verify:full
```

Live Steam smoke tests are intentionally separate because they depend on external
network and Steam data:

```bash
npm run test:e2e:live
```

## Testing Notes

- Prefer unit tests for domain mapping, route contracts, and Steam adapter parsing.
- Default Playwright tests should use mocked Steam responses.
- Keep live Steam tests tolerant of network latency and data changes.

## Repository Hygiene

- Do not commit `.env*` except `.env.example`.
- Do not commit `.next`, `bin`, `node_modules`, `test-results`, or local IDE files.
- Keep generated or exploratory design assets out unless they are used by the app.
- Commit product rename and architecture work as intentional changes, not as copied legacy code.
