/**
 * 集中查询层 — 所有 SSR 页面通过这里取 PB 数据
 *
 * 设计要点：
 * - 5 分钟内存缓存（settings / tags），避免每次请求都打 DB
 * - 字段缺失友好回退（schema 还没在 PB Admin 里加完时不应报 500）
 * - 类型清晰：组件按 Article / Note / Diary / SiteSettings 接收
 *
 * 当 PB schema 升级（加 type / excerpt / nickname 等）后，无需改组件，
 * 这里的 normalize 函数自动把新字段透传出去。
 */
import pb from './pb';

// ------------------------------ 类型 ------------------------------

export interface Article {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  tag: string;
  emoji: string;
  cover: string | null;          // PB file URL or null
  created: string;
  is_published: boolean;
}

export interface Note {
  id: string;
  slug: string;
  title: string;
  excerpt: string;               // 笔记的"正文"就放这里（短）
  tag: string;
  emoji: string;
  created: string;
  is_published: boolean;
}

export interface Diary {
  id: string;
  slug: string;
  title: string;
  content: string;
  mood: string;
  weather: string;
  date: string;
  is_public: boolean;
  created: string;
}

export interface SiteSettings {
  // 现存字段
  theme_color: string;
  glass_opacity: number;
  glass_blur: number;
  toc_text_blur: number;
  particles_enabled: boolean;
  bg_image: string | null;
  avatar_main: string | null;
  avatar_sub: string | null;
  // P1.5 新增
  nickname: string;
  tagline: string;
  bio: string;
  social_github: string;
  social_email: string;
  music_url: string;
  music_title: string;
  music_artist: string;
  active_theme: string;          // 'bento' | 'paper' | ...
  bento_layout_preset: string;   // 'default' | 'articles-first' | 'diary-focus'
  // 原始记录（图片 URL 拼接需要）
  _raw: any;
}

export interface TagCount {
  name: string;
  count: number;
}

// ------------------------------ 内存缓存 ------------------------------

interface CacheEntry<T> {
  value: T;
  expires: number;
}
const cache = new Map<string, CacheEntry<any>>();
const TTL_MS = 5 * 60 * 1000;

async function memo<T>(key: string, fetcher: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { value, expires: now + ttl });
  return value;
}

/** 控制台保存后调用，强制刷新 */
export function invalidateCache(prefix?: string) {
  if (!prefix) { cache.clear(); return; }
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

// ------------------------------ 工具 ------------------------------

function pbFileUrl(record: any, filename: string | null | undefined): string | null {
  if (!record || !filename) return null;
  try { return pb.files.getUrl(record, filename); } catch { return null; }
}

function safe<T>(v: T | undefined | null, fallback: T): T {
  return v === undefined || v === null ? fallback : v;
}

// ------------------------------ Settings ------------------------------

export async function getSettings(): Promise<SiteSettings> {
  return memo('settings', async () => {
    let raw: any = null;
    try {
      const result = await pb.collection('settings').getList(1, 1, { sort: '-created' });
      if (result.items.length > 0) raw = result.items[0];
    } catch {
      // 表不存在或网络错误，使用全部默认值
    }
    return {
      theme_color: safe(raw?.theme_color, '#A8E6CF'),
      glass_opacity: safe(raw?.glass_opacity, 0.8),
      glass_blur: safe(raw?.glass_blur, 10),
      toc_text_blur: safe(raw?.toc_text_blur, 5),
      particles_enabled: safe(raw?.particles_enabled, false),
      bg_image: pbFileUrl(raw, raw?.bg_image),
      avatar_main: pbFileUrl(raw, raw?.avatar_main),
      avatar_sub: pbFileUrl(raw, raw?.avatar_sub),
      nickname: safe(raw?.nickname, 'twj0'),
      tagline: safe(raw?.tagline, 'Day by day, life by life.'),
      bio: safe(raw?.bio, '一个把技术笔记、工具碎片和日常杂感放在同一口井里的地方。'),
      social_github: safe(raw?.social_github, ''),
      social_email: safe(raw?.social_email, ''),
      music_url: safe(raw?.music_url, ''),
      music_title: safe(raw?.music_title, ''),
      music_artist: safe(raw?.music_artist, ''),
      active_theme: safe(raw?.active_theme, 'bento'),
      bento_layout_preset: safe(raw?.bento_layout?.preset ?? raw?.bento_layout_preset, 'default'),
      _raw: raw,
    };
  });
}

// ------------------------------ Posts (article + note) ------------------------------

function normalizeArticle(r: any): Article {
  return {
    id: r.id,
    slug: safe(r.slug, r.id),
    title: safe(r.title, '(untitled)'),
    content: safe(r.content, ''),
    excerpt: safe(r.excerpt, (r.content || '').slice(0, 120)),
    tag: safe(r.tag, '杂记'),
    emoji: safe(r.emoji, '📝'),
    cover: pbFileUrl(r, r.cover),
    created: r.created,
    is_published: !!r.is_published,
  };
}

function normalizeNote(r: any): Note {
  return {
    id: r.id,
    slug: safe(r.slug, r.id),
    title: safe(r.title, '(untitled)'),
    excerpt: safe(r.excerpt, (r.content || '').slice(0, 200)),
    tag: safe(r.tag, '灵感'),
    emoji: safe(r.emoji, '💡'),
    created: r.created,
    is_published: !!r.is_published,
  };
}

/**
 * 获取文章。type 字段可能还没加 — 加之前所有 posts 当作 article 处理。
 * limit=0 表示全部。
 */
export async function getLatestArticles(limit = 50): Promise<Article[]> {
  return memo(`articles:${limit}`, async () => {
    // 策略：先尝试 type='article'；若 type 字段不存在（PB 400），fallback 到不过滤 type。
    // 这样在 schema 升级前，所有 posts 都视为 article；升级后 notes 自动从此列表剔除。
    const fetchWith = async (filter: string) => {
      const result = await pb.collection('posts').getList(1, limit || 200, {
        filter, sort: '-created',
      });
      return result.items.map(normalizeArticle);
    };
    try {
      return await fetchWith(`is_published = true && type = 'article'`);
    } catch {
      try {
        return await fetchWith(`is_published = true`);
      } catch (e) {
        console.warn('[queries] getLatestArticles failed', e);
        return [];
      }
    }
  });
}

export async function getLatestNotes(limit = 10): Promise<Note[]> {
  return memo(`notes:${limit}`, async () => {
    try {
      const filter = `is_published = true && type = 'note'`;
      const result = await pb.collection('posts').getList(1, limit, {
        filter, sort: '-created',
      });
      return result.items.map(normalizeNote);
    } catch (e) {
      // type 字段还没加 = 0 笔记
      console.warn('[queries] getLatestNotes failed (likely type field missing)', e);
      return [];
    }
  });
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const r = await pb.collection('posts').getFirstListItem(`slug = "${slug}"`);
    return normalizeArticle(r);
  } catch {
    return null;
  }
}

export async function getNoteBySlug(slug: string): Promise<Note | null> {
  try {
    const r = await pb.collection('posts').getFirstListItem(`slug = "${slug}" && type = 'note'`);
    return normalizeNote(r);
  } catch {
    return null;
  }
}

// ------------------------------ Diaries ------------------------------

function normalizeDiary(r: any): Diary {
  return {
    id: r.id,
    slug: safe(r.slug, r.id),
    title: safe(r.title, '(untitled)'),
    content: safe(r.content, ''),
    mood: safe(r.mood, '平静'),
    weather: safe(r.weather, ''),
    date: safe(r.date, r.created),
    is_public: !!r.is_public,
    created: r.created,
  };
}

export async function getRecentDiaries(limit = 5): Promise<Diary[]> {
  return memo(`diaries:${limit}`, async () => {
    try {
      const result = await pb.collection('diaries').getList(1, limit, {
        filter: 'is_public = true',
        sort: '-date',
      });
      return result.items.map(normalizeDiary);
    } catch (e) {
      // 表还没建 = 0 日记
      return [];
    }
  });
}

export async function getDiaryBySlug(slug: string): Promise<Diary | null> {
  try {
    const r = await pb.collection('diaries').getFirstListItem(
      `slug = "${slug}" && is_public = true`,
    );
    return normalizeDiary(r);
  } catch {
    return null;
  }
}

// ------------------------------ Tag Cloud ------------------------------

export async function getTagCloud(limit = 12): Promise<TagCount[]> {
  return memo(`tags:${limit}`, async () => {
    try {
      const result = await pb.collection('posts').getList(1, 200, {
        filter: 'is_published = true',
        fields: 'tag',
      });
      const counts = new Map<string, number>();
      for (const item of result.items) {
        const t = (item as any).tag;
        if (!t) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch {
      return [];
    }
  });
}
