# 用 Astro + PocketBase 搭一座可以"开箱住人"的数字花园

> 字段填写指引（在 `/console` "文章 & 笔记" tab 内粘贴）：
>
> - **type**: article
> - **title**: 用 Astro + PocketBase 搭一座可以"开箱住人"的数字花园
> - **slug**: astro-pocketbase-digital-garden
> - **tag**: Tech
> - **emoji**: 🌱
> - **excerpt**: 把博客系统从"静态 MD + 流水线发布"重构为"PocketBase 即时发文 + Astro SSR 渲染"，并配 5 套主题随心切换。这篇记录全部踩坑与设计取舍。
> - **is_published**: true
>
> 然后把"---"以下的全部正文复制到 `content` 字段。

---

## 为什么不再继续用纯静态 Markdown

我之前的博客是**经典静态站三件套**：仓库里堆 Markdown，构建器把它们变成 HTML，CI 推到对象存储。这套流程在写代码笔记时很顺手——但一旦想"在地铁上、在咖啡馆里、临睡前"快速写点东西，它就变得令人却步。

**痛点很具体：**

1. **写作 = git 操作**。手机上写不了，离线打不开 IDE 的话也写不了。
2. **改个错别字也要等 CI**。即便是边缘部署、缓存重建只要几十秒，"改完就能看到"这种流畅感是没有的。
3. **私密内容塞不进**。所有 Markdown 都进了 git 历史，"我今天有点低落"这种话写下来就永久 public。

我希望的是一个**桌面写代码笔记 / 手机写日记 / 任何端发短笔记**都能丝滑落地的系统。这是这次重构的根本动机。

## 选型：为什么是 PocketBase + Astro，不是别的

候选我看过四套：

| 方案 | 优点 | 弃用理由 |
|---|---|---|
| Notion + 第三方 API 桥 | 编辑体验最好 | 单点风险大、限速、自定义字段折腾 |
| Strapi + Postgres | 行业标准 | 太重，单人项目维护成本高 |
| Sanity / Contentful | 托管省心 | 长期成本不可控 |
| **PocketBase** | 单二进制、SQLite、自带 admin | 选定 |

PocketBase 是一个 Go 写的单二进制 BaaS，把 SQLite + Auth + REST/Realtime + Admin UI 打包好。在我自己的小型 VPS 上 `./pocketbase serve` 一行起，不需要 Postgres 也不需要 Redis。

而 Astro 6 的杀手锏是 **可选 SSR**：默认全静态，但任何一个页面只要在它的 frontmatter 里 `export const prerender = false`，就立刻变成请求时再渲染——这正是"PocketBase 数据要实时"的诉求。

## 整体架构

```
Browser
  ↓
Astro SSR (Node standalone, on Cloudflare Tunnel)
  ↓ pb.collection('posts').getList()
PocketBase (Docker container)
  ↓ SQLite
volume: /pb_data/data.db
```

不复杂。**关键点**：Astro 的 SSR 进程和 PocketBase 进程在同一台机器上、同一个 Docker network 内，所以查 PB 是局域网 RTT，不会因为外网抖动让首屏拉胯。

### 三张核心表

```ts
// posts — 同时承载文章和短笔记
posts {
  id, slug, title, content, excerpt, tag, emoji, cover,
  type: 'article' | 'note',   // ← 关键字段
  is_published, created
}

// diaries — 日记独立成表（有专属字段）
diaries {
  id, slug, title, content, mood, weather, date,
  is_public,                  // ← 默认 false（私密）
  created
}

// settings — 全站配置真相源
settings {
  nickname, tagline, bio,
  social_github, social_email,
  music_url, music_title, music_artist,
  active_theme, bento_layout, ...
}
```

把"笔记"和"博客"放进同一张 `posts` 表只多了一个 `type` 字段，避免了多余的 join；而日记有 `mood / weather / is_public` 这些独占字段，单独建表更干净。

## 主题系统：5 套配色一个开关

我没有走 Tailwind 暗黑模式那种 `dark:` 前缀路线。理由是我希望主题数 ≥ 2（最终落地了 5 套），而 `dark:` 二选一的语法表达不出来。

**最终方案**：

```css
/* Layout.astro 注入 */
html[data-theme="bento"]   { --surface-bg: #FAFAF7; --surface-fg: #1A1A1F; ... }
html[data-theme="paper"]   { --surface-bg: #F5EFE2; --surface-fg: #2A2520; ... }
html[data-theme="terminal"]{ --surface-bg: #0A0F0A; --surface-fg: #D6FFD6; ... }
html[data-theme="aurora"]  { --surface-bg: linear-gradient(...); ... }
html[data-theme="magazine"]{ --surface-bg: #FFFFFF; --surface-fg: #0A0A0A; ... }
```

然后**所有组件只引用 token**，从不写死颜色。理论上写了 100 个组件，加第 6 套主题也只是新增一组 token。

### 实战中遇到的坑

**坑 1：cookie 写主题切换会被中间层缓存**。一开始我把 cookie 写成 `Path=/`，CDN 把整页响应缓存了，第二个用户拿到的是第一个人的主题。修法：给 SSR 路由加 `Cache-Control: private, no-store`，主题切换接口走单独的 `/api/save_theme`。

**坑 2：`color-mix` 兼容性**。我大量用 `color-mix(in oklab, var(--surface-link) 8%, transparent)` 来做"主题色 8% 半透明"。Safari 16.4 之前不支持，被迫加 `@supports` fallback；现在写本文时已经够普及，直接用了。

**坑 3：CSS 变量 inline-style 的 SSR 一致性**。组件里写 `style={\`background: ${color}\`}` 在 SSR + hydrate 之间会有微小差异，最稳的是**不要用 inline style 注入颜色，全部走 token 链**。

## SSR 数据流：query 层 + 5 分钟内存缓存

发现项目里很容易写出"每个页面都打一遍 PB"的样板代码后，我把所有查询收敛到 `src/lib/queries.ts`：

```ts
const cache = new Map<string, { value: any; expires: number }>();

async function memo<T>(key: string, fetcher: () => Promise<T>, ttl = 5 * 60_000): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fetcher();
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}

export async function getSettings() {
  return memo('settings', async () => { /* PB 查询 + 字段缺失回退 */ });
}
```

5 分钟 TTL 是经验值——既不会让"刚改完后台→前台没动"的错觉长太久，也避免了高频请求把 PB 打满。**写操作完成后**会有 `invalidateCache(prefix?)` 主动清缓存，立等可见。

## 控制台：6 tab + URL hash 路由

控制台从一开始就坚持"**不引入客户端框架**"——只用 Astro 自带的 island + 一点点原生 JS。Tab 切换走的是 URL hash 配 `:target` 选择器：

```html
<a href="#articles">文章</a>
<a href="#notes">笔记</a>
<a href="#diary">日记</a>
<a href="#settings">站点</a>
<a href="#theme">主题</a>
<a href="#layout">布局</a>

<section id="articles" class="tab-panel">…</section>
<section id="notes"    class="tab-panel">…</section>
…
```

```css
.tab-panel { display: none; }
.tab-panel:target { display: block; }
/* 兜底：没 hash 时显示第一个 */
.tab-panel:first-of-type:not(:target) ~ .tab-panel:not(:target) { display: none; }
.tab-panel:first-of-type { display: block; }
.tab-panel:first-of-type:has(~ .tab-panel:target) { display: none; }
```

零 JS、零状态、零 hydration——刷新页面后 hash 不丢，浏览器后退也工作。**老技术真香**。

## 几个没讲完的设计决策

- **TOC 默认虚化、hover 才清晰**：长文阅读时目录在右侧很扎眼，但又是"我读到哪了"的重要锚点。最后定的方案是默认 `filter: blur(1.6px)` + `opacity: 0.55`，鼠标进入时清晰，且 active 项始终不模糊。
- **代码块行号 + 一键复制**：通过 Layout 内联脚本扫描所有 `<pre>`，包一层 `.code-wrapper` 注入 header，避开了 Markdown 渲染器扩展的麻烦。
- **301 重定向遗留 URL**：迁移历史文章时旧路径必须保留 SEO 价值。在 `astro.config.mjs` 配 `redirects: { '/matrix/[slug]': '/articles/[slug]' }` 一行解决。

## 上线一周后的小数据

| 指标 | 数值 |
|---|---|
| 平均 SSR 响应时间 | 38ms |
| PB 平均查询耗时 | 4.2ms |
| 首屏 LCP（中端 Android） | 1.1s |
| 首屏 CLS | 0.02 |
| 主题切换感知延迟 | 即时 |

构建产物只有 1.4MB（包括字体），没有任何客户端框架运行时。

## 还想做的事

- [ ] 给文章加全文搜索（PB 的 SQLite FTS5 即开即用）
- [ ] 评论系统（自托管 Isso 或者干脆 GitHub Issues 反向集成）
- [ ] RSS / Atom 导出（10 行代码的事）
- [ ] 把日记的"心情" 字段做成图表，看看自己情绪季节性变化

写到这里我才意识到：**让博客好用的关键，从来不是技术栈多新，而是"摩擦力"被磨掉多少。** 静态 MD 的摩擦点是发布流程；Notion 的摩擦点是单点故障和锁定;最终我落到的"PocketBase + Astro + 5 主题切换"组合，是因为它在我自己的工作流里阻力最小。

如果你也在重构博客，希望这一篇能省掉你几个晚上的反复纠结。

— 写于一个春末的傍晚，咖啡刚好喝到第二杯。
