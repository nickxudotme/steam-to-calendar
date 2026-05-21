import { expect, test } from '@playwright/test';

test('previews a Steam wishlist calendar and exposes an ICS feed URL', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /put your steam wishlist into your calendar/i })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Calendar preview', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to your Calendar' })).toBeVisible();

  const publicFeedResponse = await request.get('/feed/steam-events.ics');
  expect(publicFeedResponse.ok()).toBe(true);
  expect(publicFeedResponse.headers()['content-type']).toContain('text/calendar');
  expect(publicFeedResponse.headers()['content-disposition']).toContain('steam-events.ics');
  await expect(await publicFeedResponse.text()).toContain('BEGIN:VCALENDAR');

  await page.waitForLoadState('networkidle');

  const previewResponse = page.waitForResponse((response) =>
    response.url().includes('/api/preview') && response.request().method() === 'POST',
  );
  await page.getByLabel('Add your Steam wishlist').fill('76561198115468824');
  await page.getByRole('button', { name: 'Add to your Calendar' }).click();
  await expect((await previewResponse).ok()).toBe(true);

  await expect(page.getByRole('region', { name: 'Calendar preview', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: /calendar preview/i })).toBeVisible();
  const nextFestSegments = page.locator('[data-event-id="steam-next-fest-june-2026"]');
  await expect(nextFestSegments).toHaveCount(2);
  await expect(nextFestSegments.nth(0)).toHaveCSS('grid-column-start', '2');
  await expect(nextFestSegments.nth(0)).toHaveCSS('grid-column-end', '8');
  await expect(nextFestSegments.nth(1)).toHaveCSS('grid-column-start', '1');
  await expect(nextFestSegments.nth(1)).toHaveCSS('grid-column-end', '3');
  await nextFestSegments.nth(0).click();
  const popover = page.getByTestId('event-popover');
  await expect(popover).toBeVisible();
  await expect(popover.getByText('🧪 Steam Next Fest')).toBeVisible();
  await expect(popover.getByText('Wishlist in Calendar')).toBeVisible();
  await expect(popover.getByText('Jun 8, 2026 – Jun 15, 2026')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open site' })).toHaveAttribute('href', 'https://store.steampowered.com/');

  const feedResponse = await request.get('/feed/76561198115468824.ics');
  expect(feedResponse.ok()).toBe(true);
  expect(feedResponse.headers()['content-type']).toContain('text/calendar');
  expect(feedResponse.headers()['content-disposition']).toContain('steam-wishlist-76561198115468824.ics');
  await expect(await feedResponse.text()).toContain('BEGIN:VCALENDAR');

  const calendarResponse = await request.get('/cal/76561198115468824');
  expect(calendarResponse.ok()).toBe(true);
  expect(calendarResponse.headers()['content-type']).toContain('text/calendar');
});
