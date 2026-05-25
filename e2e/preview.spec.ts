import { expect, test } from '@playwright/test';

test('previews a Steam wishlist calendar and exposes an ICS feed URL', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.getByText('Steam Sale Calendar').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Calendar preview', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add to your Calendar' }).first()).toBeVisible();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();

  const publicFeedResponse = await request.get('/feed/steam-events.ics');
  expect(publicFeedResponse.ok()).toBe(true);
  expect(publicFeedResponse.headers()['content-type']).toContain('text/calendar');
  expect(publicFeedResponse.headers()['content-disposition']).toContain('steam-sale-calendar.ics');
  await expect(await publicFeedResponse.text()).toContain('BEGIN:VCALENDAR');

  await page.waitForLoadState('networkidle');

  const previewResponse = page.waitForResponse((response) =>
    response.url().includes('/api/preview') && response.request().method() === 'POST',
  );
  await page.getByLabel('Paste your Steam Profile URL').fill('https://steamcommunity.com/id/nickxudotme/');
  await page.getByRole('button', { name: 'Import Steam Wishlist' }).click();
  await expect((await previewResponse).ok()).toBe(true);

  await expect(page.getByRole('region', { name: 'Calendar preview', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: /continuous calendar grid/i })).toBeVisible();
  await expect(page.locator('[data-testid="calendar-event-segment"]').first()).toBeVisible();
  await expect(page.getByTestId('event-popover')).toHaveCount(0);

  const feedResponse = await request.get('/feed/76561198115468824.ics');
  expect(feedResponse.ok()).toBe(true);
  expect(feedResponse.headers()['content-type']).toContain('text/calendar');
  expect(feedResponse.headers()['content-disposition']).toContain('steam-wishlist-76561198115468824.ics');
  await expect(await feedResponse.text()).toContain('BEGIN:VCALENDAR');

  const calendarResponse = await request.get('/cal/76561198115468824');
  expect(calendarResponse.ok()).toBe(true);
  expect(calendarResponse.headers()['content-type']).toContain('text/calendar');
});
