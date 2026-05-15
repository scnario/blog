/**
 * Atom Feed — 最新 20 篇文章
 *
 * 与 /rss.xml 并存，部分阅读器（NetNewsWire 等）更倾向 Atom。
 */
import type { APIRoute } from 'astro';
import { getSettings, getLatestArticles } from '../lib/queries';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async (context) => {
  const settings = await getSettings();
  const articles = await getLatestArticles(20);

  const siteUrl = (context.site?.toString() ?? new URL(context.url).origin).replace(/\/$/, '');
  const feedUrl = `${siteUrl}/atom.xml`;
  const updated = articles.length > 0
    ? new Date(articles[0].created).toISOString()
    : new Date().toISOString();

  const title = xmlEscape(`${settings.nickname || 'scnario'} · 数字花园`);
  const subtitle = xmlEscape(settings.tagline || '技术笔记 · 工具碎片 · 日常杂感');
  const author = xmlEscape(settings.nickname || 'scnario');

  const entries = articles.map((a) => {
    const url = `${siteUrl}/articles/${a.slug}`;
    const created = new Date(a.created).toISOString();
    const categoryTag = a.tag ? `\n    <category term="${xmlEscape(a.tag)}"/>` : '';
    return `  <entry>
    <title>${xmlEscape(a.title)}</title>
    <link href="${url}"/>
    <id>${url}</id>
    <updated>${created}</updated>
    <published>${created}</published>
    <summary type="html">${xmlEscape(a.excerpt)}</summary>${categoryTag}
  </entry>`;
  }).join('\n');

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
  <title>${title}</title>
  <subtitle>${subtitle}</subtitle>
  <link href="${siteUrl}/"/>
  <link rel="self" href="${feedUrl}"/>
  <id>${siteUrl}/</id>
  <updated>${updated}</updated>
  <author><name>${author}</name></author>
${entries}
</feed>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
