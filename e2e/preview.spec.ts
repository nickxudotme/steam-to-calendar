import { expect, test } from '@playwright/test';

test('previews a Steam wishlist calendar and exposes an ICS feed URL', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.getByText('Steam to Calendar').first()).toBeVisible();
  await page.getByRole('button', { name: 'Start tracking' }).click();
  await expect(page.getByRole('region', { name: 'Calendar preview', exact: true })).toBeVisible();
  const headerControls = page.locator('.headerControls');
  await expect(headerControls.locator('.regionSelect .selectDisplayText')).toHaveText(/United States|China/);
  await expect(headerControls.getByLabel('Steam store region')).toContainText('🇦🇪 United Arab Emirates');
  const languageSelect = headerControls.locator('.languageSelect select');
  await expect(languageSelect).toBeVisible();
  const addCalendarLink = page.locator('.calendarFooterCta').first();
  await expect(addCalendarLink).toBeVisible();
  await expect(page.locator('.sourceCard').filter({ hasText: 'Hot Deals & Preorders' })).toHaveCount(0);
  await expect(page.getByLabel('Games added to calendar')).toBeVisible();
  await expect(page.locator('.selectedGameRow')).toHaveCount(3);
  await expect(addCalendarLink).toHaveAttribute(
    'href',
    /webcal:\/\/.+\/cal\/steam-events\?.*deals=0.*apps=\d.*count=3.*cc=/,
  );
  await languageSelect.selectOption('zh-CN');
  await expect(addCalendarLink).toHaveAttribute('href', /[?&]lang=schinese&uiLang=zh-CN/);
  await expect(page.getByText('追踪内容')).toBeVisible();
  await expect(page.getByRole('button', { name: '今天', exact: true })).toBeVisible();
  await languageSelect.selectOption('en');
  await expect(page.getByRole('button', { name: 'Previous month' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next month' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Week', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.locator('[data-testid="calendar-event-list-item"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();

  await page.getByLabel('Search Steam games').fill('620');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.locator('.gameSearchResult').first()).toBeVisible();
  await page.locator('.gameSearchResult').first().click();
  await expect(page.getByLabel('Games added to calendar')).toBeVisible();
  await expect(page.getByLabel('Games added to calendar').getByText('Portal 2')).toBeVisible();
  await expect(page.locator('.undoToast')).toContainText('Portal 2 added to calendar');
  await page.locator('.undoToast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Games added to calendar').getByText('Portal 2')).toHaveCount(0);
  await page.locator('.gameSearchResult').first().click();
  await expect(page.getByLabel('Games added to calendar').getByText('Portal 2')).toBeVisible();
  await expect(addCalendarLink).toHaveAttribute('href', /[?&]apps=\d/);

  await page.locator('.sourceDisclosureButton').click();
  await page.locator('.eventTypeOption').filter({ hasText: 'Theme fests' }).click();
  await expect(addCalendarLink).toHaveAttribute('href', /eventTypes=seasonal/);
  await page.locator('.eventTypeOption').filter({ hasText: 'Theme fests' }).click();

  const publicFeedResponse = await request.get('/feed/steam-events.ics?deals=0&events=1&wishlist=0');
  expect(publicFeedResponse.ok()).toBe(true);
  expect(publicFeedResponse.headers()['content-type']).toContain('text/calendar');
  expect(publicFeedResponse.headers()['content-disposition']).toContain('steam-sale-calendar.ics');
  await expect(await publicFeedResponse.text()).toContain('BEGIN:VCALENDAR');

  const emptyPublicPreviewResponse = await request.get('/api/public-preview?deals=0&events=0&wishlist=0&count=3&pastDays=0&futureDays=30');
  expect(emptyPublicPreviewResponse.ok()).toBe(true);
  expect((await emptyPublicPreviewResponse.json()).events).toEqual([]);

  await page.locator('.sourceCard').filter({ hasText: 'Steam Events' }).locator('.switch').click();

  const previewResponse = page.waitForResponse((response) =>
    response.url().includes('/api/preview') && response.request().method() === 'POST',
  );
  await page.locator('.wishlistImportDetails summary').click();
  await page.locator('#steam-id').fill('https://steamcommunity.com/id/nickxudotme/');
  await page.locator('.wishlistImport button[type="submit"]').click();
  await expect((await previewResponse).ok()).toBe(true);
  await expect(page.getByText('Wishlist connected. Manual game picks are ignored')).toBeVisible();
  const importedCalendarHref = await addCalendarLink.getAttribute('href');
  expect(importedCalendarHref).toContain('/cal/76561198115468824');
  expect(importedCalendarHref).not.toContain('apps=');

  await expect(page.getByRole('region', { name: 'Calendar preview', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: /continuous calendar grid/i })).toBeVisible();
  await expect(page.getByTestId('event-popover')).toHaveCount(0);

  const feedResponse = await request.get('/feed/76561198115468824.ics?deals=0&events=0&wishlist=1');
  expect(feedResponse.ok()).toBe(true);
  expect(feedResponse.headers()['content-type']).toContain('text/calendar');
  expect(feedResponse.headers()['content-disposition']).toContain('steam-wishlist-76561198115468824.ics');
  await expect(await feedResponse.text()).toContain('BEGIN:VCALENDAR');

  const calendarResponse = await request.get('/cal/76561198115468824?deals=0&events=0&wishlist=1');
  expect(calendarResponse.ok()).toBe(true);
  expect(calendarResponse.headers()['content-type']).toContain('text/calendar');
});
