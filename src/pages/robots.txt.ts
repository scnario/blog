/**
 * robots.txt — 全站抓取策略
 *
 * 显式禁掉 /console 和 /api，给 sitemap 指路。
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = (context) => {
  const base = (context.site?.toString() ?? new URL(context.url).origin).replace(/\/$/, '');
  const body = `User-agent: *
Allow: /
Disallow: /console
Disallow: /console/
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
