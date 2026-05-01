import { expect, test } from '@playwright/test';

test('home page renders core navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('首页');
  await expect(page.locator('a[href="/articles"]').first()).toBeVisible();
  await expect(page.locator('a[href="/search"]').first()).toBeVisible();
});

test('public routes respond with page content', async ({ page }) => {
  for (const route of ['/articles', '/notes', '/diary', '/search', '/console']) {
    await page.goto(route);
    await expect(page.locator('body')).not.toBeEmpty();
  }
});

test('theme cookie controls html data-theme', async ({ page, context }) => {
  await context.addCookies([{ name: 'site_theme', value: 'terminal', url: 'http://127.0.0.1:4321' }]);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'terminal');
});

test('production hardening endpoints respond safely', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  expect(health.headers()['cache-control']).toContain('no-store');

  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /console');

  const invalidationGet = await request.get('/api/invalidate-cache');
  expect(invalidationGet.status()).toBe(404);

  const invalidationPost = await request.post('/api/invalidate-cache', { data: {} });
  expect(invalidationPost.ok()).toBeTruthy();
});
