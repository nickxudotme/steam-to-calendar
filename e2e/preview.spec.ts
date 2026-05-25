import { expect, test } from '@playwright/test';

test('previews a Steam wishlist calendar and exposes an ICS feed URL', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.getByText('Steam Sale Calendar').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Calendar preview', exact: true })).toBeVisible();
  const headerControls = page.locator('.headerControls');
  await expect(page.getByText('🇺🇸 United States Store')).toBeVisible();
  await expect(headerControls.getByLabel('Steam store region')).toContainText('🇦🇪 United Arab Emirates');
  await expect(headerControls.getByLabel('Language')).toContainText('简体中文');
  const addCalendarLink = page.locator('.calendarCta').first();
  await expect(addCalendarLink).toBeVisible();
  await expect(addCalendarLink).toHaveAttribute(
    'href',
    /webcal:\/\/.+\/cal\/steam-events\?deals=1&events=1&eventTypes=seasonal%2Cnext_fest%2Cfest%2Cstore_sale&wishlist=1&count=5&pastDays=0&futureDays=365&cc=/,
  );
  await headerControls.getByLabel('Language').selectOption('zh-CN');
  await expect(addCalendarLink).toHaveAttribute('href', /[?&]lang=schinese&uiLang=zh-CN/);
  await headerControls.getByLabel('Language').selectOption('en');
  await expect(page.getByRole('button', { name: 'Previous month' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next month' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Week', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.locator('[data-testid="calendar-event-list-item"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();

  await page.getByLabel('Search Steam games').fill('subnautica');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.locator('.gameSearchResult').first()).toBeVisible();
  await page.locator('.gameSearchResult').first().getByRole('button', { name: 'Add' }).click();
  await expect(page.getByLabel('Games added to calendar')).toBeVisible();
  await expect(page.locator('.selectedGameRow.isNewlyAdded')).toBeVisible();
  await expect(addCalendarLink).toHaveAttribute('href', /[?&]apps=\d/);

  await page.locator('.sourceCard').filter({ hasText: 'Hot Deals & Preorders' }).locator('.switch').click();
  await expect(addCalendarLink).toHaveAttribute('href', /[?&]deals=0/);
  await page.locator('.sourceCard').filter({ hasText: 'Hot Deals & Preorders' }).locator('.switch').click();
  await page.locator('.eventTypeOption').filter({ hasText: 'Theme fests' }).click();
  await expect(addCalendarLink).toHaveAttribute('href', /eventTypes=seasonal%2Cnext_fest%2Cstore_sale/);
  await page.locator('.eventTypeOption').filter({ hasText: 'Theme fests' }).click();

  const publicFeedResponse = await request.get('/feed/steam-events.ics?deals=0&events=1&wishlist=0');
  expect(publicFeedResponse.ok()).toBe(true);
  expect(publicFeedResponse.headers()['content-type']).toContain('text/calendar');
  expect(publicFeedResponse.headers()['content-disposition']).toContain('steam-sale-calendar.ics');
  await expect(await publicFeedResponse.text()).toContain('BEGIN:VCALENDAR');

  const emptyPublicPreviewResponse = await request.get('/api/public-preview?deals=0&events=0&wishlist=0&count=3&pastDays=0&futureDays=30');
  expect(emptyPublicPreviewResponse.ok()).toBe(true);
  expect((await emptyPublicPreviewResponse.json()).events).toEqual([]);

  await page.locator('.sourceCard').filter({ hasText: 'Hot Deals & Preorders' }).locator('.switch').click();
  await page.locator('.sourceCard').filter({ hasText: 'Steam Sales & Fests' }).locator('.switch').click();

  const previewResponse = page.waitForResponse((response) =>
    response.url().includes('/api/preview') && response.request().method() === 'POST',
  );
  await page.getByLabel('Paste your Steam Profile URL').fill('https://steamcommunity.com/id/nickxudotme/');
  await page.getByRole('button', { name: 'Import Steam Wishlist' }).click();
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
