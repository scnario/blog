/**
 * 主题系统 — 单一真相源
 *
 * 架构原则：
 * - 每个主题 = 一组完整的视觉 / 动效 / 结构（不是简单的颜色变量切换）
 * - 不同 route 类型可独立选择不同主题（首页 Bento + 日记 Paper 这种组合是一等公民）
 * - 当前主题来源优先级：cookie > PB settings.active_theme > 默认 'bento'
 *
 * 如何扩展新主题：
 * 1. 在 THEMES 注册表里加一项
 * 2. 在 src/themes/<slug>/ 下放 home.astro / post.astro / diary.astro（阶段性实装）
 * 3. 可选：在 PB settings 表里加 active_theme 字段作为站点默认
 */

export type ThemeSlug = 'bento' | 'paper' | 'terminal' | 'aurora' | 'magazine';
export type RouteKind = 'home' | 'post' | 'diary' | 'tool';

export interface ThemeMeta {
  slug: ThemeSlug;
  name: string;
  tagline: string;
  icon: string;
  color: string;          // 代表色（主题切换器上的色点）
  darkMode: boolean;
  /** 支持的路由类型。不在此列表的 route 会回落到 'bento' */
  supports: RouteKind[];
  /** 预览 URL（当前指向原型页；整合完成后改为首页）*/
  previewPath: string;
}

export const THEMES: Record<ThemeSlug, ThemeMeta> = {
  bento: {
    slug: 'bento',
    name: 'Bento Grid',
    tagline: '明亮彩色瓷砖，信息聚合',
    icon: '🍱',
    color: '#A8E6CF',
    darkMode: false,
    supports: ['home', 'post', 'diary', 'tool'],
    previewPath: '/prototypes/bento',
  },
  paper: {
    slug: 'paper',
    name: 'Paper Zen',
    tagline: '纸感 / 衬线 / 日记气质',
    icon: '📝',
    color: '#9A3232',
    darkMode: false,
    supports: ['home', 'post', 'diary'],
    previewPath: '/prototypes/paper',
  },
  terminal: {
    slug: 'terminal',
    name: 'Terminal',
    tagline: '伪终端极客风',
    icon: '💻',
    color: '#3DFF8A',
    darkMode: true,
    supports: ['home', 'post'],
    previewPath: '/prototypes/terminal',
  },
  aurora: {
    slug: 'aurora',
    name: 'Aurora Glass',
    tagline: '深色极光玻璃',
    icon: '✨',
    color: '#A259FF',
    darkMode: true,
    supports: ['home', 'post', 'diary'],
    previewPath: '/prototypes/aurora',
  },
  magazine: {
    slug: 'magazine',
    name: 'Magazine',
    tagline: '黑白杂志大字号',
    icon: '📰',
    color: '#C8102E',
    darkMode: false,
    supports: ['home', 'post'],
    previewPath: '/prototypes/magazine',
  },
};

export const DEFAULT_THEME: ThemeSlug = 'bento';
export const COOKIE_NAME = 'site_theme';

export function isThemeSlug(v: unknown): v is ThemeSlug {
  return typeof v === 'string' && v in THEMES;
}

/**
 * 从 Astro 请求上下文解析当前主题
 * cookie > PB settings.active_theme > DEFAULT_THEME
 */
export function resolveTheme(opts: {
  cookieValue?: string | null;
  pbActiveTheme?: string | null;
}): ThemeSlug {
  if (isThemeSlug(opts.cookieValue)) return opts.cookieValue;
  if (isThemeSlug(opts.pbActiveTheme)) return opts.pbActiveTheme;
  return DEFAULT_THEME;
}

/**
 * 给定主题 + route 类型，返回要渲染的主题实际支持的 slug
 * 若当前主题不支持该 route（比如 terminal 没有 diary），回落到默认
 */
export function resolveThemeForRoute(
  theme: ThemeSlug,
  kind: RouteKind,
): ThemeSlug {
  const meta = THEMES[theme];
  if (meta.supports.includes(kind)) return theme;
  return DEFAULT_THEME;
}

export function listThemes(): ThemeMeta[] {
  return Object.values(THEMES);
}
