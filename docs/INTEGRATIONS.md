# 可选集成接入说明

评论 / 统计 / 邮件订阅都已通过组件 + API 接入，但**不会自动启用**——所有第三方账号、站点 ID 与密钥都通过环境变量注入；变量留空则相应模块不渲染、不联网。

## Analytics — 已接入 `<Analytics />`

实现位于 `src/components/Analytics.astro`，在 `Layout.astro` 的 `<head>` 末尾挂载。`import.meta.env.DEV` 下永远不渲染（不污染本地统计）。

支持四种 provider：

| `PUBLIC_ANALYTICS_PROVIDER` | 必填变量 | 输出 |
|---|---|---|
| `plausible` | `PUBLIC_ANALYTICS_SITE_ID`=域名 | `<script defer data-domain=…>`，默认官方 CDN，可用 `PUBLIC_ANALYTICS_SCRIPT_URL` 覆盖 |
| `umami`     | `PUBLIC_ANALYTICS_SITE_ID` + `PUBLIC_ANALYTICS_SCRIPT_URL` | umami 自托管 |
| `goatcounter` | `PUBLIC_ANALYTICS_SITE_ID`=子域名 | GoatCounter `//gc.zgo.at/count.js` |
| `script`    | `PUBLIC_ANALYTICS_SCRIPT_URL` | 透传任意脚本（无附加属性） |

```env
PUBLIC_ANALYTICS_PROVIDER=plausible
PUBLIC_ANALYTICS_SITE_ID=showcase.91917788.xyz
```

## Comments — 已接入 Giscus

实现位于 `src/components/Comments.astro`，挂载在 `articles/[slug].astro` 底部。4 个变量必须全部填齐才渲染：

```env
PUBLIC_GISCUS_REPO=scnario/blog-comments
PUBLIC_GISCUS_REPO_ID=R_xxx
PUBLIC_GISCUS_CATEGORY=Announcements
PUBLIC_GISCUS_CATEGORY_ID=DIC_xxx
```

主题用 `preferred_color_scheme`，跟随用户系统的 dark/light。

PocketBase 自建评论方案（仍可选，未实现 UI）：

| collection | 字段 |
|---|---|
| `comments` | `post_slug`, `author`, `email_hash`, `content`, `status`, `created` |

## Email subscription — 已接入 `<Subscribe />` + `/api/subscribe`

表单组件 `src/components/Subscribe.astro` 挂在文章详情页底部；POST 转发由 `src/pages/api/subscribe.ts` 处理，按 `SUBSCRIBE_PROVIDER` 选择上游：

| `SUBSCRIBE_PROVIDER` | 必填变量 | 说明 |
|---|---|---|
| `buttondown` | `SUBSCRIBE_API_KEY` | 最简单。新订阅 + 已订阅都视作成功。 |
| `resend`     | `SUBSCRIBE_API_KEY` + `SUBSCRIBE_LIST_ID` | Resend audiences |
| `mailchimp`  | `SUBSCRIBE_API_KEY`（带 `-us21` dc 后缀）+ `SUBSCRIBE_LIST_ID` | 默认 `pending` 状态启用 double opt-in |
| `pb`         | 无 | 写入 PB 的 `subscribers` 表，需先在 PB Admin 建表（字段 `email`） |

```env
SUBSCRIBE_PROVIDER=buttondown
SUBSCRIBE_API_KEY=xxx
```

反垃圾：

- 内存级 60s/IP 速率限制（多实例时不够，按需替换为 Redis）
- email 语法 + 长度（< 254）校验
- 隐藏 `_hp` honeypot 字段，机器人填了直接 204

未配置 provider 时 API 返回 `503 { ok:false, error:"订阅暂未开放，欢迎用 RSS" }`，表单会展示该提示并已经在副标题里链向 `/atom.xml`。

## i18n

当前站点以中文内容为主。若未来做英文版，优先只国际化 UI 文案；内容多语言需要 PB schema 扩展（如 `title_en`, `content_en`）和 URL 策略确认（如 `/en/...`）。
