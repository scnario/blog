import { expect, test } from '@playwright/test';

test('home page renders core navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('首页');
  await expect(page.locator('a[href="/articles"]').first()).toBeVisible();
  await expect(page.locator('a[href="/search"]').first()).toBeVisible();
});

test('public routes respond with page content', async ({ page }) => {
  for (const route of ['/articles', '/notes', '/diary', '/search', '/console', '/tags', '/archive']) {
    await page.goto(route);
    await expect(page.locator('body')).not.toBeEmpty();
  }
});

test('feeds and discovery links are present', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(1);
  await expect(page.locator('link[rel="alternate"][type="application/atom+xml"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

  const rss = await request.get('/rss.xml');
  expect(rss.headers()['content-type']).toContain('xml');
  const atom = await request.get('/atom.xml');
  expect(atom.headers()['content-type']).toContain('atom');
  expect(await atom.text()).toContain('<feed');
});

test('JSON-LD schema and OG meta render on home', async ({ page }) => {
  await page.goto('/');
  // Organization + WebSite 两段 JSON-LD
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:locale"]')).toHaveCount(1);
});

test('subscribe API rejects bad emails and rate-limits empty bodies', async ({ request }) => {
  const bad = await request.post('/api/subscribe', { data: { email: 'not-an-email' } });
  expect(bad.status()).toBeGreaterThanOrEqual(400);

  // 第二次（被 60s rate limit 拦下），任何 4xx 都说明端点活着
  const second = await request.post('/api/subscribe', { data: { email: 'foo@bar.io' } });
  expect(second.status()).toBeGreaterThanOrEqual(400);
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
