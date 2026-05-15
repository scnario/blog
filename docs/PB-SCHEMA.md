# PocketBase Schema 升级清单

> 控制台所有功能在 PB schema 缺字段时会**优雅降级**（写入失败 / 字段读不到 → 用默认值），但是要让"主题持久化、笔记 / 日记真的能存"，需要按本清单在 PB Admin (`https://db.91917788.xyz/_/`) 里加好字段和表。
>
> 不需要全部一次做完。按"想用哪个功能就开哪个字段"的顺序来即可。

---

## 1. `posts` 表 — 加 5 个字段

要让博客 / 笔记分流、Bento 首页 emoji + 摘要、文章封面图工作，需要：

| 字段名 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `type` | **Select** (single) | `article` | 选项写两个：`article`, `note`。控制台「文章 & 笔记」tab 用它分流。 |
| `excerpt` | **Plain text** (max 200) | 空 | Bento 卡片摘要 / 笔记的"正文"（笔记很短，主要内容就放这里）。 |
| `tag` | **Plain text** (max 32) | 空 | 单一主标签，用于 Bento 首页的标签云聚合。 |
| `emoji` | **Plain text** (max 4) | 空 | Bento 卡片左上角小 emoji。 |
| `cover` | **File** (single, image, max 2MB) | — | 文章封面图（可选），显示在大瓷砖上。 |

**API Rules**（建议）：
```
List/View Rule:   is_published = true || @request.auth.id != ""
Create/Update/Delete Rule: 留空（仅 admin 可写）
```

**已有数据迁移**（在 PB Admin 控制台 → `posts` 表右上角"⋯"→ Export records → 改 type 字段 → 重新 import；或者用 console 编辑器逐条勾选 type=article）。

---

## 2. `diaries` 表 — **新建**

让日记模块工作。

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `slug` | Plain text, **Unique** | ✓ | URL 段 |
| `title` | Plain text | ✓ | 标题 |
| `content` | **Editor** (rich text) 或 Plain text | — | Markdown 正文 |
| `mood` | Plain text (max 16) | — | 心情：平静 / 兴奋 / 低落 / 专注 |
| `weather` | Plain text (max 16) | — | 天气：晴 / 多云 / … |
| `date` | **Date** | ✓ | 日记日期，与 `created` 区分 |
| `is_public` | **Bool**, default `false` | — | 默认私密，勾选才公开 |

**API Rules**（关键 — 防止未登录读到私密日记）：
```
List Rule:    is_public = true || @request.auth.id != ""
View Rule:    is_public = true || @request.auth.id != ""
Create/Update/Delete Rule: 留空（仅 admin）
```

---

## 3. `settings` 表 — 加约 10 个字段

| 字段名 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `nickname` | Plain text (max 32) | — | 站点昵称 / TopNav 品牌名 |
| `tagline` | Plain text (max 80) | `Day by day, life by life.` | 首页副标题 |
| `bio` | Plain text (max 200) | — | 简介（ProfileCard 用） |
| `social_github` | URL 或 Plain text | — | GitHub URL |
| `social_email` | Plain text | — | 邮箱 |
| `social_twitter` | Plain text (max 32) | — | X / Twitter handle，**不带 @**（如 `scnario`）。用于 `twitter:creator` 卡片署名。 |
| `music_url` | URL | — | 音频文件 URL |
| `music_title` | Plain text | — | 曲名 |
| `music_artist` | Plain text | — | 艺术家 |
| `active_theme` | **Select** (single) | `bento-webui` | 选项写七个：`bento-webui`, `sticky-notes`, `bento`, `paper`, `terminal`, `aurora`, `magazine` |
| `bento_layout` | **JSON** | `{}` | 形如 `{"preset": "default"}`；不创建也行，控制台会回退到 `bento_layout_preset` 字段。 |
| `bento_layout_preset` | Plain text | `default` | `bento_layout` 的回退（如果不想用 JSON 字段就用这个 string） |
| `visual_paper` | Color 或 Plain text | `#F8F4EC` | Bento / 便签全局纸底色 |
| `visual_ink` | Color 或 Plain text | `#1A1814` | 全局墨色、硬边框色 |
| `visual_mint` | Color 或 Plain text | `#A8E6CF` | Bento / 便签 mint 瓷砖色 |
| `visual_coral` | Color 或 Plain text | `#FFCCBC` | Bento / 便签 coral 瓷砖色 |
| `visual_lilac` | Color 或 Plain text | `#E0BBE4` | Bento / 便签 lilac 瓷砖色 |
| `visual_cream` | Color 或 Plain text | `#FFE082` | Bento / 便签 cream 瓷砖色 |
| `visual_dot_size` | Number | `24` | 点阵背景间距（px） |
| `visual_shadow` | Plain text | `4px 4px 0 #1A1814` | 硬投影 CSS 值 |
| `console_accent` | Color 或 Plain text | `#B8311E` | Editorial A 深色控制台强调色 |

**API Rules**：
```
List/View Rule: 留空（公开可读，因为前端 SSR 要拉它）
Create/Update/Delete Rule: 留空（仅 admin）
```

---

## 4. 一次性数据迁移

把现有 posts 都标记为 `type='article'`：

进入 PB Admin → `posts` 表 → 全选 → 批量编辑（如果你的 PB 版本不支持，进控制台「文章 & 笔记」tab 一条条点也行）。

---

## 5. 验证清单

- [ ] PB Admin 能看到 `posts.type` / `excerpt` / `tag` / `emoji` / `cover`
- [ ] PB Admin 有 `diaries` 表，包含 `is_public` bool 默认 false
- [ ] PB Admin 的 `settings.active_theme` 是 select 类型，能看到 7 个选项（默认 `bento-webui`）
- [ ] 进 `/console` 登录 → 主题 tab 选 `paper` → 保存 → 回首页 `/`，**整页字体变成衬线、底色变奶油**
  - 没变？检查浏览器 cookie `site_theme=paper` 是否被写入
  - 改了 cookie 仍没变？说明 SSR 缓存没刷新；强制刷一下 `Ctrl+F5` 即可（控制台保存时已自动调 `/api/invalidate-cache`）
- [ ] `/console` → 文章 tab 创建 type=note → 回首页"最新笔记"瓷砖出现
- [ ] `/console` → 日记 tab 创建条目（不勾公开）→ `/diary` 不显示；改公开后出现

---

## 排错快查

| 现象 | 原因 | 解决 |
|---|---|---|
| 控制台保存 settings 报 `unknown field "nickname"` | PB schema 缺字段 | 按表 3 加字段 |
| `/notes` 永远是空状态 | `posts.type` 字段不存在 | 按表 1 加 `type` 字段并把现有 post 标 article、新建 note |
| `/diary` 报 500 | `diaries` 表不存在 | 按表 2 建表 |
| 改主题后没视觉变化 | 缓存或 cookie 没更新 | `Ctrl+F5` 硬刷；或 `/console` → 主题 tab 看 cookie 状态 |
| 切到 `terminal` 主题 → 进 `/diary` 还是 bento 风 | terminal 主题不支持 diary（设计如此） | 见 `src/lib/theme.ts` 的 `supports` 数组 |
