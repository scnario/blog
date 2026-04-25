/**
 * Bento 首页布局预设
 *
 * 控制台只暴露"选预设"，不做拖拽（参见 plan: 续作设计/决策四）。
 * 加新预设：在 PRESETS 注册一项；首页根据 preset id 选择对应顺序与跨度。
 *
 * tile id 必须是首页 SSR 已支持的瓷砖之一，参见 src/pages/index.astro 里的 switch。
 */

export type TileId =
  | 'hero'
  | 'latest-article'   // 大卡：最新博客
  | 'profile'
  | 'music'
  | 'diaries'          // 时间线
  | 'tags'             // 标签云
  | 'notes'            // 最新笔记 3 张小卡（聚合在一个 tile 里）
  | 'more-articles'    // 次新博客 3 张
  | 'tools'
  | 'footer';

export interface TileSpec {
  id: TileId;
  /** 12 栅 grid 跨列数 */
  span: number;
  /** 行跨度，默认 1 */
  rowSpan?: number;
}

export interface BentoPreset {
  id: string;
  name: string;
  tagline: string;
  tiles: TileSpec[];
}

export const PRESETS: Record<string, BentoPreset> = {
  default: {
    id: 'default',
    name: '默认布局',
    tagline: '兼顾博客 / 笔记 / 日记 三者',
    tiles: [
      { id: 'hero',           span: 12 },
      { id: 'latest-article', span: 6, rowSpan: 2 },
      { id: 'profile',        span: 3 },
      { id: 'music',          span: 3 },
      { id: 'diaries',        span: 6 },
      { id: 'tags',           span: 3 },
      { id: 'notes',          span: 3 },
      { id: 'more-articles',  span: 12 },
      { id: 'tools',          span: 6 },
      { id: 'footer',         span: 12 },
    ],
  },
  'articles-first': {
    id: 'articles-first',
    name: '文章优先',
    tagline: '把最新长文 + 次新文章顶上去',
    tiles: [
      { id: 'hero',           span: 12 },
      { id: 'latest-article', span: 8, rowSpan: 2 },
      { id: 'profile',        span: 4 },
      { id: 'more-articles',  span: 12 },
      { id: 'tags',           span: 4 },
      { id: 'notes',          span: 4 },
      { id: 'diaries',        span: 4 },
      { id: 'music',          span: 6 },
      { id: 'tools',          span: 6 },
      { id: 'footer',         span: 12 },
    ],
  },
  'diary-focus': {
    id: 'diary-focus',
    name: '日记焦点',
    tagline: '让日记时间线坐 C 位',
    tiles: [
      { id: 'hero',     span: 12 },
      { id: 'diaries',  span: 8, rowSpan: 2 },
      { id: 'profile',  span: 4 },
      { id: 'music',    span: 4 },
      { id: 'latest-article', span: 8 },
      { id: 'notes',    span: 6 },
      { id: 'tags',     span: 6 },
      { id: 'more-articles', span: 12 },
      { id: 'tools',    span: 12 },
      { id: 'footer',   span: 12 },
    ],
  },
};

export const DEFAULT_PRESET = 'default';

export function resolvePreset(id: string | null | undefined): BentoPreset {
  return PRESETS[id ?? DEFAULT_PRESET] ?? PRESETS[DEFAULT_PRESET];
}

export function listPresets(): BentoPreset[] {
  return Object.values(PRESETS);
}
