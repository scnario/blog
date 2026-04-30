/**
 * Sitemap — 全站 SEO 地图
 */
import type { APIRoute } from 'astro';
import { getLatestArticles, getLatestNotes, getRecentDiaries } from '../lib/queries';

export const GET: APIRoute = async (context) => {
  const base = context.site?.toString() ?? new URL(context.url).origin;

  const [articles, notes, diaries] = await Promise.all([
    getLatestArticles(200),
    getLatestNotes(200),
    getRecentDiaries(200),
  ]);

  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${base}/articles</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `<url><loc>${base}/notes</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${base}/diary</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ...articles.map((a) =>
      `<url><loc>${base}/articles/${a.slug}</loc><lastmod>${new Date(a.created).toISOString()}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    ),
    ...notes.map((n) =>
      `<url><loc>${base}/notes/${n.slug}</loc><lastmod>${new Date(n.created).toISOString()}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`
    ),
    ...diaries.map((d) =>
      `<url><loc>${base}/diary/${d.slug}</loc><lastmod>${new Date(d.date || d.created).toISOString()}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
