# Wishlist in Calendar

Put your Steam wishlist into the calendar you actually live in.

This is the local Weekend Prototype. It accepts a SteamID64, reads the public Steam wishlist page, fetches Steam app details, keeps future exact release dates plus a small Steam major-events seed, and serves an `.ics` feed.

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Sample SteamID64:

```text
76561199022537892
```

## Calendar feed

The feed route is:

```text
http://localhost:3000/feed/{steamId64}.ics
```

The one-click subscription route is extensionless:

```text
webcal://localhost:3000/cal/{steamId64}
```

For the sample:

```text
http://localhost:3000/feed/76561199022537892.ics
```

Apple Calendar local check:

1. Open the homepage.
2. Click `Preview`.
3. Click `Apple Calendar`, or copy the feed URL.
4. In Apple Calendar, use `File -> New Calendar Subscription`.

## What is in scope

- SteamID64 only.
- Public wishlist only.
- Future exact release dates only.
- Small fixed Steam major-events seed.
- Local `.ics` feed.
- Apple Calendar manual verification.

## What is intentionally out of scope

- Steam login.
- Vanity profile URLs.
- Accounts.
- Share pages.
- Donation.
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
