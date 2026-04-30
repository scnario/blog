# 博客 · Astro + PocketBase

个人博客 / 笔记 / 日记三合一的“数字花园”。前端 Astro 6 SSR，数据走 PocketBase BaaS，内置 7 套主题、12 栅 Bento 首页、6-tab 控制台、SSR 内存缓存、Docker 部署和一键导入样本。示例网站：https://showcase.91917788.xyz/

## 项目亮点

- **三合一内容模型**：文章、笔记、日记统一放在同一套站点结构里，列表页与详情页分别适配不同阅读场景。
- **主题 token 化**：7 套主题共用 CSS token，页面和组件尽量通过 `var(--surface-*)` / `var(--card-*)` 等变量适配外观。
- **Bento 首页**：首页使用 12 栅 Bento 布局，并支持 3 种 preset 切换。
- **控制台后台**：`/console` 提供文章 / 笔记 / 日记 / 站点 / 主题 / 布局 6 个 tab 的管理入口。
- **SSR + 缓存 + 部署闭环**：Astro SSR 负责服务端取数，PocketBase 提供数据层，`queries.ts` 内置 5 分钟内存缓存，Docker / Compose 提供部署路径。
- **回归入口**：仓库提供 Vitest 与 Playwright 配置，可通过 `npm run test` 和 `npm run test:e2e` 做回归验证。

## 开发方式

这个项目主要按“我提需求 + Agent 实现 + Agent 自测”的循环推进：需求拆分、页面实现、后台功能、主题系统、构建验证和文档维护都在同一个仓库内闭环完成。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端框架 | Astro 6 + `@astrojs/node` standalone（SSR） |
| 样式 | Tailwind 4 + 自定义 CSS token，7 主题统一变量 |
| 动效 | Motion One（~3KB）+ Astro `<ClientRouter />` |
| 数据 | PocketBase 0.26.x（通过 `PB_URL` 环境变量连接） |
| 内容渲染 | `marked`（Markdown → HTML） |
| 部署 | Docker + Node 22 |

## 路由表

| 路径 | 数据来源 | 说明 |
|---|---|---|
| `/` | `posts`（最近）+ `diaries` + `settings` | Bento 12 栅首页，3 种 preset 切换 |
| `/articles` | `posts` where `type='article'`（无字段时回退所有） | 列表 + 卡片栈 |
| `/articles/[slug]` | 单篇文章 | 卡片化版式 + TOC（hover 解虚化） |
| `/notes` | `posts` where `type='note'` | 短卡网格 |
| `/notes/[slug]` | 单条笔记 | 顶部 emoji + tag 双分区 |
| `/diary` | `diaries` where `is_public=true` | 月份分组时间线 |
| `/diary/[slug]` | 单篇日记 | 暖色卡片，主题局部别名 |
| `/console` | 6 tab：文章 / 笔记 / 日记 / 站点 / 主题 / 布局 | URL hash 路由，无前端框架 |

## 主题（7 套）

`bento`（旧版回退） / `paper` / `terminal` / `aurora` / `magazine` / `bento-webui`（默认） / `sticky-notes`。

切换走 cookie + PB `settings.active_theme` 双链路，刷新后整页颜色 + 字体 + 圆角全部跟随。注册表见 `src/lib/theme.ts`。

```js
// 浏览器调试切换：
document.cookie = 'site_theme=terminal; path=/; max-age=31536000';
location.reload();
```

## 本地开发

```bash
npm install
npm run dev      # localhost:4321
npm run build    # 产出 dist/server + dist/client
npm run preview  # 跑 dist 验证
npm run test     # Vitest 回归
npm run test:e2e # Playwright E2E 回归
```

需要 Node ≥ 22.12（见 `engines`）。

PocketBase 地址通过环境变量配置。公开展示分支中的 `.env.example` 只保留占位值，实际部署时在服务器环境变量中设置真实地址：

```bash
PB_URL=https://your-pocketbase.example.com
```

## 一键导入样本

仓库 `samples/` 下有 3 篇长样本（博客 / 笔记 / 日记），用于检查列表 + 详情卡片在所有主题下的视觉。

```bash
# 1) 验证解析（不写库）
npm run seed:dry

# 2) 真正写入 PB（需要 admin 账号）
PB_EMAIL=admin@example.com PB_PASSWORD=xxx npm run seed

# 已存在 slug 时强制覆盖
PB_EMAIL=... PB_PASSWORD=... FORCE=1 npm run seed
```

环境变量见 `.env.example`。脚本逻辑：
- 解析 `> - **key**: value` blockquote frontmatter + `---` 后正文
- `posts` 优先带 `type` 字段创建；schema 没升级时自动回退
- 同 slug 默认跳过；`FORCE=1` 走 update

## PB schema

详见 `docs/PB-SCHEMA.md`。最小需要：
- `posts(slug, title, type?, tag, emoji, excerpt, content, is_published)`
- `diaries(slug, title, mood, weather, date, content, is_public)`
- `settings`（单条）— 站点全局：昵称 / 头像 / 主题 / 布局 / 背景图

## 目录结构

```
src/
├── components/    # TopNav, ProfileCard, TocPanel, BentoGrid 等
├── layouts/       # Layout.astro（注入 ClientRouter + 主题 token）
├── lib/
│   ├── queries.ts   # PB SDK 封装 + 5min 内存缓存
│   ├── theme.ts     # 7 主题注册表
│   ├── motion.ts    # inViewStagger 工具
│   └── bento-presets.ts
├── pages/
│   ├── index.astro
│   ├── articles/ notes/ diary/  # 列表 + [slug]
│   └── console.astro
└── styles/
    ├── global.css
    └── theme.css
samples/         # 长测试样本（md）
scripts/         # seed-samples.ts
docs/            # PB-SCHEMA / 设计笔记
```

## 缓存

dev / 生产都开 5 分钟内存缓存（`src/lib/queries.ts`）。改完数据后强刷或 `GET /api/invalidate-cache` 立即生效。

## License

私人博客，未授权不再分发。
