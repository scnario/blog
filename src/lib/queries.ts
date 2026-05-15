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
  content: string;
  excerpt: string;
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
  social_twitter: string;        // 仅 handle，如 "scnario"（不带 @）
  music_url: string;
  music_title: string;
  music_artist: string;
  active_theme: string;          // 'bento' | 'paper' | ...
  bento_layout_preset: string;   // 'default' | 'articles-first' | 'diary-focus'
  visual_paper: string;
  visual_ink: string;
  visual_mint: string;
  visual_coral: string;
  visual_lilac: string;
  visual_cream: string;
  visual_dot_size: number;
  visual_shadow: string;
  console_accent: string;
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

function pbString(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
      nickname: safe(raw?.nickname, 'scnario'),
      tagline: safe(raw?.tagline, 'Day by day, life by life.'),
      bio: safe(raw?.bio, '一个把技术笔记、工具碎片和日常杂感放在同一口井里的地方。'),
      social_github: raw?.social_github || 'https://github.com/scnario/blog',
      social_email: safe(raw?.social_email, ''),
      social_twitter: safe(raw?.social_twitter, '').replace(/^@/, ''),
      music_url: safe(raw?.music_url, ''),
      music_title: safe(raw?.music_title, ''),
      music_artist: safe(raw?.music_artist, ''),
      active_theme: safe(raw?.active_theme, 'bento-webui'),
      bento_layout_preset: safe(raw?.bento_layout?.preset ?? raw?.bento_layout_preset, 'default'),
      visual_paper: safe(raw?.visual_paper, '#F8F4EC'),
      visual_ink: safe(raw?.visual_ink, '#1A1814'),
      visual_mint: safe(raw?.visual_mint, '#A8E6CF'),
      visual_coral: safe(raw?.visual_coral, '#FFCCBC'),
      visual_lilac: safe(raw?.visual_lilac, '#E0BBE4'),
      visual_cream: safe(raw?.visual_cream, '#FFE082'),
      visual_dot_size: safe(raw?.visual_dot_size, 24),
      visual_shadow: safe(raw?.visual_shadow, '4px 4px 0 #1A1814'),
      console_accent: safe(raw?.console_accent, '#B8311E'),
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
    content: safe(r.content, ''),
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

export async function getPaginatedNotes(page = 1, perPage = PER_PAGE): Promise<PaginatedResult<Note>> {
  const cacheKey = `notes:p:${page}:${perPage}`;
  return memo(cacheKey, async () => {
    try {
      const filter = `is_published = true && type = 'note'`;
      const result = await pb.collection('posts').getList(page, perPage, {
        filter, sort: '-created',
      });
      return {
        items: result.items.map(normalizeNote),
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      };
    } catch (e) {
      console.warn('[queries] getPaginatedNotes failed', e);
      return { items: [], page: 1, perPage, totalItems: 0, totalPages: 0 };
    }
  });
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const r = await pb.collection('posts').getFirstListItem(
      `slug = "${pbString(slug)}" && is_published = true`,
    );
    return normalizeArticle(r);
  } catch {
    return null;
  }
}

/** 获取当前文章的前一篇和后一篇（按创建时间） */
export async function getAdjacentArticles(slug: string): Promise<{ prev: Article | null; next: Article | null }> {
  const current = await getArticleBySlug(slug);
  if (!current) return { prev: null, next: null };

  try {
    // 上一篇：更早发布的
    const prevResult = await pb.collection('posts').getList(1, 1, {
      filter: `is_published = true && type = 'article' && created < "${current.created}"`,
      sort: '-created',
    });
    // 下一篇：更晚发布的
    const nextResult = await pb.collection('posts').getList(1, 1, {
      filter: `is_published = true && type = 'article' && created > "${current.created}"`,
      sort: '+created',
    });
    return {
      prev: prevResult.items.length > 0 ? normalizeArticle(prevResult.items[0]) : null,
      next: nextResult.items.length > 0 ? normalizeArticle(nextResult.items[0]) : null,
    };
  } catch {
    return { prev: null, next: null };
  }
}

// ------------------------------ 分页 + 标签过滤 ------------------------------

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

const PER_PAGE = 12;

export async function getPaginatedArticles(page = 1, perPage = PER_PAGE): Promise<PaginatedResult<Article>> {
  const cacheKey = `articles:p:${page}:${perPage}`;
  return memo(cacheKey, async () => {
    const fetchWith = async (filter: string) => {
      const result = await pb.collection('posts').getList(page, perPage, {
        filter, sort: '-created',
      });
      return {
        items: result.items.map(normalizeArticle),
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      };
    };
    try {
      return await fetchWith(`is_published = true && type = 'article'`);
    } catch {
      try {
        return await fetchWith(`is_published = true`);
      } catch (e) {
        console.warn('[queries] getPaginatedArticles failed', e);
        return { items: [], page: 1, perPage, totalItems: 0, totalPages: 0 };
      }
    }
  });
}

export async function getArticlesByTag(tag: string, page = 1, perPage = PER_PAGE): Promise<PaginatedResult<Article>> {
  const cacheKey = `articles:tag:${tag}:${page}:${perPage}`;
  return memo(cacheKey, async () => {
    try {
      const filter = `is_published = true && tag = "${pbString(tag)}"`;
      const result = await pb.collection('posts').getList(page, perPage, {
        filter, sort: '-created',
      });
      return {
        items: result.items.map(normalizeArticle),
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      };
    } catch (e) {
      console.warn(`[queries] getArticlesByTag("${tag}") failed`, e);
      return { items: [], page: 1, perPage, totalItems: 0, totalPages: 0 };
    }
  });
}

export async function getNoteBySlug(slug: string): Promise<Note | null> {
  try {
    const r = await pb.collection('posts').getFirstListItem(`slug = "${pbString(slug)}" && type = 'note'`);
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
    } catch {
      // 表还没建 = 0 日记
      return [];
    }
  });
}

export async function getDiaryBySlug(slug: string): Promise<Diary | null> {
  try {
    const r = await pb.collection('diaries').getFirstListItem(
      `slug = "${pbString(slug)}" && is_public = true`,
    );
    return normalizeDiary(r);
  } catch {
    return null;
  }
}

// ------------------------------ Tag Cloud ------------------------------

/**
 * 相关文章推荐：同标签优先，按发布时间降序，剔除自己。
 * 若同标签不足 limit 条，用最新文章补齐。
 */
export async function getRelatedArticles(slug: string, tag: string, limit = 3): Promise<Article[]> {
  const cacheKey = `articles:related:${slug}:${tag}:${limit}`;
  return memo(cacheKey, async () => {
    try {
      const items: Article[] = [];
      const seen = new Set<string>([slug]);

      if (tag) {
        const sameTag = await pb.collection('posts').getList(1, limit + 1, {
          filter: `is_published = true && tag = "${pbString(tag)}" && slug != "${pbString(slug)}"`,
          sort: '-created',
        });
        for (const r of sameTag.items) {
          const a = normalizeArticle(r);
          if (seen.has(a.slug)) continue;
          items.push(a);
          seen.add(a.slug);
          if (items.length >= limit) return items;
        }
      }

      // 不够则用最新文章补齐
      const fallback = await pb.collection('posts').getList(1, limit + 5, {
        filter: `is_published = true && slug != "${pbString(slug)}"`,
        sort: '-created',
      });
      for (const r of fallback.items) {
        const a = normalizeArticle(r);
        if (seen.has(a.slug)) continue;
        items.push(a);
        seen.add(a.slug);
        if (items.length >= limit) break;
      }
      return items;
    } catch (e) {
      console.warn('[queries] getRelatedArticles failed', e);
      return [];
    }
  });
}

// ------------------------------ Archive ------------------------------

export interface ArchiveEntry {
  slug: string;
  title: string;
  tag: string;
  emoji: string;
  created: string;
}

export interface ArchiveMonth {
  year: number;
  month: number;     // 1-12
  items: ArchiveEntry[];
}

export interface ArchiveYear {
  year: number;
  total: number;
  months: ArchiveMonth[];
}

/**
 * 归档：按年/月分组所有已发布文章。
 * 一次性拉全量（上限 500，按博客规模足够），客户端再分页代价大。
 */
export async function getArchive(): Promise<ArchiveYear[]> {
  return memo('archive', async () => {
    const fetchWith = async (filter: string) => {
      const result = await pb.collection('posts').getList(1, 500, {
        filter, sort: '-created',
        fields: 'slug,title,tag,emoji,created',
      });
      return result.items;
    };
    let raw: any[] = [];
    try {
      raw = await fetchWith(`is_published = true && type = 'article'`);
    } catch {
      try {
        raw = await fetchWith(`is_published = true`);
      } catch (e) {
        console.warn('[queries] getArchive failed', e);
        return [];
      }
    }

    const byYearMonth = new Map<string, ArchiveMonth>();
    for (const r of raw) {
      const d = new Date(r.created);
      if (Number.isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${m}`;
      let bucket = byYearMonth.get(key);
      if (!bucket) {
        bucket = { year: y, month: m, items: [] };
        byYearMonth.set(key, bucket);
      }
      bucket.items.push({
        slug: safe(r.slug, r.id),
        title: safe(r.title, '(untitled)'),
        tag: safe(r.tag, ''),
        emoji: safe(r.emoji, '📝'),
        created: r.created,
      });
    }

    const byYear = new Map<number, ArchiveYear>();
    for (const m of byYearMonth.values()) {
      let yEntry = byYear.get(m.year);
      if (!yEntry) {
        yEntry = { year: m.year, total: 0, months: [] };
        byYear.set(m.year, yEntry);
      }
      yEntry.months.push(m);
      yEntry.total += m.items.length;
    }
    return [...byYear.values()]
      .sort((a, b) => b.year - a.year)
      .map((y) => ({
        ...y,
        months: y.months.sort((a, b) => b.month - a.month),
      }));
  });
}

export async function getTagCloud(limit = 12): Promise<TagCount[]> {
  return memo(`tags:${limit}`, async () => {
    try {
      const result = await pb.collection('posts').getList(1, 500, {
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

/** 全部标签（不限 limit），用于 /tags 总览页 */
export async function getAllTags(): Promise<TagCount[]> {
  return getTagCloud(9999);
}
