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
        "content-disposition":
          "attachment; filename=steam-to-calendar-wishlist-76561198115468824.ics",
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start tracking" }).click();

  await expect(page.getByRole("region", { name: "Calendar preview", exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();
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
  expect(feed.contentDisposition).toContain("steam-to-calendar-wishlist-76561198115468824.ics");
  expect(feed.text).toContain("BEGIN:VCALENDAR");
});

test("previews a Steam wishlist calendar and exposes an ICS feed URL @steam-live", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await expect(page.getByText("Steam to Calendar").first()).toBeVisible();
  await page.getByRole("button", { name: "Start tracking" }).click();
  await expect(page.getByRole("region", { name: "Calendar preview", exact: true })).toBeVisible();
  const headerControls = page.locator(".headerControls");
  await expect(headerControls.locator(".regionSelect .selectDisplayText")).toHaveText(
    /United States|China/,
  );
  await expect(headerControls.getByLabel("Steam store region")).toContainText(
    "🇦🇪 United Arab Emirates",
  );
  const languageSelect = headerControls.locator(".languageSelect select");
  await expect(languageSelect).toBeVisible();
  const addCalendarLink = page.locator(".setupReadyCta").first();
  await expect(addCalendarLink).toBeVisible();
  await expect(
    page.locator(".sourceCard").filter({ hasText: "Hot Deals & Preorders" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Games added to calendar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".selectedGameRow")).toHaveCount(3, { timeout: 30_000 });
  await expect(addCalendarLink).toHaveAttribute(
    "href",
    /webcal:\/\/.+\/cal\/steam-events\?.*deals=0.*apps=\d.*count=3.*cc=/,
  );
  await languageSelect.selectOption("zh-CN");
  await expect(addCalendarLink).toHaveAttribute("href", /[?&]lang=schinese&uiLang=zh-CN/);
  await expect(page.getByRole("button", { name: "今天", exact: true })).toBeVisible();
  await languageSelect.selectOption("en");
  await expect(page.getByRole("button", { name: "Previous month" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next month" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Today", exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator('[data-testid="calendar-event-list-item"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();

  await page.getByLabel("Search Steam games").fill("620");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.locator(".gameSearchResult").first()).toBeVisible();
  await page.locator(".gameSearchResult").first().click();
  await expect(page.getByLabel("Games added to calendar")).toBeVisible();
  await expect(page.getByLabel("Games added to calendar").getByText("Portal 2")).toBeVisible();
  await expect(page.locator(".undoToast")).toContainText("Portal 2 added to calendar");
  await page.locator(".undoToast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Games added to calendar").getByText("Portal 2")).toHaveCount(0);
  await page.locator(".gameSearchResult").first().click();
  await expect(page.getByLabel("Games added to calendar").getByText("Portal 2")).toBeVisible();
  await expect(addCalendarLink).toHaveAttribute("href", /[?&]apps=\d/);

  await page.locator(".sourceDisclosureButton").click();
  await page.locator(".eventTypeOption").filter({ hasText: "Theme fests" }).click();
  await expect(addCalendarLink).toHaveAttribute("href", /eventTypes=seasonal/);
  await page.locator(".eventTypeOption").filter({ hasText: "Theme fests" }).click();

  const publicFeedResponse = await request.get(
    "/feed/steam-events.ics?deals=0&events=1&wishlist=0",
  );
  expect(publicFeedResponse.ok()).toBe(true);
  expect(publicFeedResponse.headers()["content-type"]).toContain("text/calendar");
  expect(publicFeedResponse.headers()["content-disposition"]).toContain("steam-to-calendar.ics");
  await expect(await publicFeedResponse.text()).toContain("BEGIN:VCALENDAR");

  const emptyPublicPreviewResponse = await request.get(
    "/api/public-preview?deals=0&events=0&wishlist=0&count=3&pastDays=0&futureDays=30",
  );
  expect(emptyPublicPreviewResponse.ok()).toBe(true);
  expect((await emptyPublicPreviewResponse.json()).events).toEqual([]);

  await page.locator(".sourceCard").filter({ hasText: "Steam Events" }).locator(".switch").click();

  await page.getByRole("button", { name: "Connect wishlist" }).click();
  await page.locator("#steam-id").fill("https://steamcommunity.com/id/nickxudotme/");
  const previewResponse = page.waitForResponse(
    (response) => response.url().includes("/api/preview") && response.request().method() === "POST",
  );
  await page.locator('.wishlistImport button[type="submit"]').click();
  await expect((await previewResponse).ok()).toBe(true);
  await expect(page.getByText("Wishlist connected. Manual game picks are ignored")).toBeVisible();
  const importedCalendarHref = await addCalendarLink.getAttribute("href");
  expect(importedCalendarHref).toContain("/cal/76561198115468824");
  expect(importedCalendarHref).not.toContain("apps=");

  await expect(page.getByRole("region", { name: "Calendar preview", exact: true })).toBeVisible();
  await expect(page.getByRole("grid", { name: /continuous calendar grid/i })).toBeVisible();
  await expect(page.getByTestId("event-popover")).toHaveCount(0);

  const feedResponse = await request.get("/feed/76561198115468824.ics?deals=0&events=0&wishlist=1");
  expect(feedResponse.ok()).toBe(true);
  expect(feedResponse.headers()["content-type"]).toContain("text/calendar");
  expect(feedResponse.headers()["content-disposition"]).toContain(
    "steam-to-calendar-wishlist-76561198115468824.ics",
  );
  await expect(await feedResponse.text()).toContain("BEGIN:VCALENDAR");

  const calendarResponse = await request.get("/cal/76561198115468824?deals=0&events=0&wishlist=1");
  expect(calendarResponse.ok()).toBe(true);
  expect(calendarResponse.headers()["content-type"]).toContain("text/calendar");
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
