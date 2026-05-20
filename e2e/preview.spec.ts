import { expect, test } from '@playwright/test';

test('previews a Steam wishlist calendar and exposes an ICS feed URL', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /put your steam wishlist/i })).toBeVisible();
  await page.waitForLoadState('networkidle');

  const previewResponse = page.waitForResponse((response) =>
    response.url().includes('/api/preview') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect((await previewResponse).ok()).toBe(true);

  await expect(page.getByText('Calendar feed')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByLabel('Calendar feed URL')).toHaveValue(/\/feed\/76561198115468824\.ics$/);
  await expect(page.getByText(/Apple Calendar often rejects/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Import Calendar' })).toHaveAttribute(
    'href',
    /^webcal:\/\/localhost:3000\/cal\/76561198115468824$/,
  );
  await expect(page.getByRole('button', { name: 'Copy URL' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open .ics' })).toHaveAttribute(
    'href',
    '/feed/76561198115468824.ics',
  );
  await expect(page.getByText(/wishlist apps/i)).toBeVisible();

  const feedResponse = await request.get('/feed/76561198115468824.ics');
  expect(feedResponse.ok()).toBe(true);
  expect(feedResponse.headers()['content-type']).toContain('text/calendar');
  expect(feedResponse.headers()['content-disposition']).toContain('steam-wishlist-76561198115468824.ics');
  await expect(await feedResponse.text()).toContain('BEGIN:VCALENDAR');

  const calendarResponse = await request.get('/cal/76561198115468824');
  expect(calendarResponse.ok()).toBe(true);
  expect(calendarResponse.headers()['content-type']).toContain('text/calendar');
});
