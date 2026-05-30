import { expect, test } from "@playwright/test";

test("previews, searches, and edits a calendar with mocked Steam data", async ({ page }) => {
  await page.route("**/api/public-preview?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        steamId64: "steam-events",
        feedPath: "/feed/steam-events.ics",
        calendarPath: "/cal/steam-events",
        wishlistUrl: "",
        locale: { cc: "US", lang: "english", uiLang: "en" },
        stats: {
          wishlistGames: 0,
          appDetails: 0,
          skippedAppIds: 0,
          wishlistReleaseEvents: 0,
          steamMajorEvents: 1,
          priceHistoryEvents: 0,
          storeFallbackEvents: 0,
        },
        events: [
          {
            id: "steam-next-fest-2026",
            title: "Steam Next Fest",
            description: "Playable demos.",
            startDate: "2026-06-08",
            endDate: "2026-06-15",
            sourceUrl: "https://store.steampowered.com/",
            type: "steam_major_event",
            eventCategory: "fest",
          },
        ],
      },
    });
  });
  await page.route("**/api/search-games?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        results: [
          {
            appId: "620",
            imageUrl: "https://cdn.example.test/portal-2.jpg",
            name: "Portal 2",
            price: {
              discountPercent: 0,
              finalFormatted: "$9.99",
            },
            reviewCount: 1000,
            reviewPercentage: 98,
            reviewSummary: "Overwhelmingly Positive",
            storeUrl: "https://store.steampowered.com/app/620/",
          },
        ],
      },
    });
  });
  await page.route("**/api/preview?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        steamId64: "76561198115468824",
        feedPath: "/feed/76561198115468824.ics",
        calendarPath: "/cal/76561198115468824",
        wishlistUrl: "https://store.steampowered.com/wishlist/profiles/76561198115468824/",
        profileName: "Nick Xu",
        wishlistGames: [
          {
            appId: "620",
            imageUrl: "https://cdn.example.test/portal-2.jpg",
            name: "Portal 2",
            releaseDateText: "Apr 18, 2011",
            storeUrl: "https://store.steampowered.com/app/620/",
          },
        ],
        locale: { cc: "US", lang: "english", uiLang: "en" },
        stats: {
          wishlistGames: 1,
          appDetails: 1,
          skippedAppIds: 0,
          wishlistReleaseEvents: 1,
          steamMajorEvents: 0,
          priceHistoryEvents: 0,
          storeFallbackEvents: 0,
        },
        events: [
          {
            id: "steam-app-620-release",
            title: "🎮 Portal 2 releases",
            description: "Steam app 620",
            startDate: "2026-06-01",
            sourceUrl: "https://store.steampowered.com/app/620/",
            type: "wishlist_release",
            appId: "620",
            imageUrl: "https://cdn.example.test/portal-2.jpg",
          },
        ],
      },
    });
  });
  await page.route("**/feed/*.ics?**", async (route) => {
    await route.fulfill({
      body: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n",
      contentType: "text/calendar; charset=utf-8",
      headers: {
        "content-disposition": "attachment; filename=steam-to-calendar-wishlist.ics",
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start tracking" }).click();

  await expect(page.getByRole("region", { name: "Calendar preview", exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();
  await expect(page.locator(".buildPanelNotice")).toContainText(
    "Steam to Calendar is not affiliated with Valve Corp.",
  );
  await expect(page.getByRole("link", { name: "GitHub repository" })).toHaveAttribute(
    "href",
    "https://github.com/nickxudotme/steam-to-calendar",
  );
  await expect(page.getByRole("link", { name: "Buy me a coffee" })).toHaveAttribute(
    "href",
    "https://buymeacoffee.com/nickxu.me",
  );
  await expect(page.locator(".calendarActionBar .calendarIconLinks")).toHaveCount(1);
  const addCalendarLink = page.locator(".setupReadyCta").first();
  await expect(addCalendarLink).toHaveAttribute("href", /webcal:\/\/.+\/cal\/steam-events/);

  await page.getByLabel("Search Steam games").fill("Portal 2");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.locator(".gameSearchResult").first()).toContainText("Portal 2");
  await page.locator(".gameSearchResult").first().click();
  await expect(page.getByLabel("Games added to calendar").getByText("Portal 2")).toBeVisible();
  await expect(page.locator(".undoToast")).toContainText("Portal 2 added to calendar");
  await page.locator(".undoToast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Games added to calendar").getByText("Portal 2")).toHaveCount(0);

  await page.getByRole("button", { name: "Connect wishlist" }).click();
  await page.locator("#steam-id").fill("https://steamcommunity.com/id/nickxudotme/");
  await page.locator('.wishlistImport button[type="submit"]').click();
  await expect(page.getByText("Wishlist connected. Manual game picks are ignored")).toBeVisible();
  await expect(addCalendarLink).toHaveAttribute("href", /\/cal\/76561198115468824/);

  const feed = await page.evaluate(async () => {
    const response = await fetch("/feed/76561198115468824.ics?deals=0&events=0&wishlist=1");
    return {
      contentDisposition: response.headers.get("content-disposition"),
      contentType: response.headers.get("content-type"),
      ok: response.ok,
      text: await response.text(),
    };
  });
  expect(feed.ok).toBe(true);
  expect(feed.contentType).toContain("text/calendar");
  expect(feed.contentDisposition).toContain("steam-to-calendar-wishlist.ics");
  expect(feed.text).toContain("BEGIN:VCALENDAR");
});

test("clicking a tracked game scrolls the calendar to its event", async ({ page }) => {
  await page.route("**/api/public-preview?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        steamId64: "steam-events",
        feedPath: "/feed/steam-events.ics",
        calendarPath: "/cal/steam-events",
        wishlistUrl: "",
        locale: { cc: "US", lang: "english", uiLang: "en" },
        stats: {
          wishlistGames: 0,
          appDetails: 1,
          skippedAppIds: 0,
          wishlistReleaseEvents: 0,
          steamMajorEvents: 1,
          priceHistoryEvents: 1,
          storeFallbackEvents: 0,
        },
        events: [
          {
            id: "steam-next-fest-2026",
            title: "Steam Next Fest",
            description: "Playable demos.",
            startDate: "2026-06-08",
            endDate: "2026-06-15",
            sourceUrl: "https://store.steampowered.com/",
            type: "steam_major_event",
            eventCategory: "fest",
          },
          {
            id: "steam-app-620-active-deal-2026-09-01-0",
            appId: "620",
            description: "Steam discount.",
            discount: "-80%",
            finalPrice: "$1.99",
            imageUrl: "https://cdn.example.test/portal-2.jpg",
            originalPrice: "$9.99",
            releaseDateText: "Apr 18, 2011",
            sourceUrl: "https://store.steampowered.com/app/620/",
            startDate: "2026-09-01",
            title: "-80% Portal 2",
            type: "steam_deal",
          },
        ],
      },
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("steam-to-calendar-intro-seen", "1");
  });
  await page.goto("/");

  await expect(page.getByLabel("Games added to calendar").getByText("Portal 2")).toBeVisible();
  const calendarScroll = page.locator(".calendarScroll");
  const portalSegment = page.locator('[data-event-id="steam-app-620-active-deal-2026-09-01-0"]');

  await calendarScroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page
    .getByLabel("Games added to calendar")
    .getByRole("button", { exact: true, name: "Portal 2" })
    .click();

  await expect(portalSegment).toHaveClass(/isSelected/);
  await expect
    .poll(async () =>
      portalSegment.evaluate((element) => {
        const scroller = element.closest(".calendarScroll");
        if (!scroller) {
          return false;
        }

        const scrollerRect = scroller.getBoundingClientRect();
        const segmentRect = element.getBoundingClientRect();

        return segmentRect.bottom >= scrollerRect.top && segmentRect.top <= scrollerRect.bottom;
      }),
    )
    .toBe(true);
});

test("clicking an imported wishlist game scrolls the calendar to its event", async ({ page }) => {
  await page.route("**/api/public-preview?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        steamId64: "steam-events",
        feedPath: "/feed/steam-events.ics",
        calendarPath: "/cal/steam-events",
        wishlistUrl: "",
        locale: { cc: "US", lang: "english", uiLang: "en" },
        stats: {
          wishlistGames: 0,
          appDetails: 0,
          skippedAppIds: 0,
          wishlistReleaseEvents: 0,
          steamMajorEvents: 1,
          priceHistoryEvents: 0,
          storeFallbackEvents: 0,
        },
        events: [
          {
            id: "steam-next-fest-2026",
            title: "Steam Next Fest",
            description: "Playable demos.",
            startDate: "2026-06-08",
            endDate: "2026-06-15",
            sourceUrl: "https://store.steampowered.com/",
            type: "steam_major_event",
            eventCategory: "fest",
          },
        ],
      },
    });
  });
  await page.route("**/api/preview?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        steamId64: "76561198115468824",
        feedPath: "/feed/76561198115468824.ics",
        calendarPath: "/cal/76561198115468824",
        wishlistUrl: "https://store.steampowered.com/wishlist/profiles/76561198115468824/",
        profileName: "Nick Xu",
        wishlistGames: [
          {
            appId: "620",
            imageUrl: "https://cdn.example.test/portal-2.jpg",
            name: "Portal 2",
            releaseDateText: "Apr 18, 2011",
            storeUrl: "https://store.steampowered.com/app/620/",
          },
        ],
        locale: { cc: "US", lang: "english", uiLang: "en" },
        stats: {
          wishlistGames: 1,
          appDetails: 1,
          skippedAppIds: 0,
          wishlistReleaseEvents: 1,
          steamMajorEvents: 0,
          priceHistoryEvents: 0,
          storeFallbackEvents: 0,
        },
        events: [
          {
            id: "steam-app-620-release",
            appId: "620",
            description: "Steam app 620",
            imageUrl: "https://cdn.example.test/portal-2.jpg",
            sourceUrl: "https://store.steampowered.com/app/620/",
            startDate: "2026-04-30",
            title: "🎮 Portal 2 releases",
            type: "wishlist_release",
          },
        ],
      },
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("steam-to-calendar-intro-seen", "1");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect wishlist" }).click();
  await page.locator("#steam-id").fill("https://steamcommunity.com/id/nickxudotme/");
  await page.locator('.wishlistImport button[type="submit"]').click();

  await expect(page.getByLabel("Wishlist games").getByText("Portal 2")).toBeVisible();
  const calendarScroll = page.locator(".calendarScroll");
  const portalSegment = page.locator('[data-event-id="steam-app-620-release"]');

  await calendarScroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page
    .getByLabel("Wishlist games")
    .getByRole("button", { exact: true, name: "Portal 2" })
    .click();

  await expect(portalSegment).toHaveClass(/isSelected/);
  await expect
    .poll(async () =>
      portalSegment.evaluate((element) => {
        const scroller = element.closest(".calendarScroll");
        if (!scroller) {
          return false;
        }

        const scrollerRect = scroller.getBoundingClientRect();
        const segmentRect = element.getBoundingClientRect();

        return segmentRect.bottom >= scrollerRect.top && segmentRect.top <= scrollerRect.bottom;
      }),
    )
    .toBe(true);
});

test("live Steam smoke returns preview and feed contracts @steam-live", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);

  const publicPreviewResponse = await request.get(
    "/api/public-preview?deals=0&events=1&wishlist=0&count=1&pastDays=0&futureDays=30",
    { timeout: 20_000 },
  );
  test.skip(
    !publicPreviewResponse.ok(),
    `Steam public preview unavailable: ${publicPreviewResponse.status()}`,
  );
  const publicPreview = await publicPreviewResponse.json();
  expect(publicPreview.steamId64).toBe("steam-events");
  expect(Array.isArray(publicPreview.events)).toBe(true);

  const publicFeedResponse = await request.get(
    "/feed/steam-events.ics?deals=0&events=1&wishlist=0&count=1",
    { timeout: 20_000 },
  );
  test.skip(
    !publicFeedResponse.ok(),
    `Steam public feed unavailable: ${publicFeedResponse.status()}`,
  );
  expect(publicFeedResponse.headers()["content-type"]).toContain("text/calendar");
  expect(publicFeedResponse.headers()["content-disposition"]).toContain("steam-to-calendar.ics");
  await expect(await publicFeedResponse.text()).toContain("BEGIN:VCALENDAR");

  await page.goto("/");
  await expect(page.getByText("Steam to Calendar").first()).toBeVisible();
  await page.getByRole("button", { name: "Start tracking" }).click();
  await expect(page.getByRole("region", { name: "Calendar preview", exact: true })).toBeVisible();
  await expect(page.locator(".setupReadyCta").first()).toBeVisible();

  const wishlistPreviewResponse = await request.post("/api/preview?lang=english&uiLang=en", {
    data: {
      steamId64: "https://steamcommunity.com/id/nickxudotme/",
      cc: "US",
      deals: false,
      priceHistory: false,
      events: false,
      eventTypes: "none",
      wishlist: true,
      apps: "",
      count: 1,
      pastDays: 0,
      futureDays: 30,
    },
    timeout: 30_000,
  });
  test.skip(
    !wishlistPreviewResponse.ok(),
    `Steam wishlist preview unavailable: ${wishlistPreviewResponse.status()}`,
  );
  const wishlistPreview = await wishlistPreviewResponse.json();
  expect(wishlistPreview.calendarPath).toMatch(/^\/cal\/7656\d{13}$/);
  expect(Array.isArray(wishlistPreview.wishlistGames)).toBe(true);

  const feedResponse = await request.get(
    `${wishlistPreview.feedPath}?deals=0&events=0&wishlist=1&count=1`,
    { timeout: 30_000 },
  );
  test.skip(!feedResponse.ok(), `Steam wishlist feed unavailable: ${feedResponse.status()}`);
  expect(feedResponse.headers()["content-type"]).toContain("text/calendar");
  expect(feedResponse.headers()["content-disposition"]).toContain("steam-to-calendar-wishlist.ics");
  await expect(await feedResponse.text()).toContain("BEGIN:VCALENDAR");
});

test("opens the calendar month view by default on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem("steam-to-calendar-intro-seen", "1");
  });
  await page.goto("/");

  await expect(page.locator(".calendarApp")).not.toHaveClass(/isListView/);
  await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".calendarScroll")).toBeVisible();
});
