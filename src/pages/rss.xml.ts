/**
 * RSS Feed — 最新 20 篇文章
 */
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getSettings, getLatestArticles } from '../lib/queries';

export const GET: APIRoute = async (context) => {
  const settings = await getSettings();
  const articles = await getLatestArticles(20);

  return rss({
    title: `${settings.nickname || 'scnario'} · 数字花园`,
    description: settings.tagline || '技术笔记 · 工具碎片 · 日常杂感',
    site: context.site?.toString() ?? new URL(context.url).origin,
    items: articles.map((a) => ({
      title: a.title,
      description: a.excerpt,
      link: `/articles/${a.slug}`,
      pubDate: new Date(a.created),
      categories: a.tag ? [a.tag] : [],
    })),
    customData: `<language>zh-CN</language>`,
  });
};
