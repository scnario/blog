# 可选集成占位说明

本项目不硬编码第三方账号、站点 ID 或密钥。评论、统计、邮件订阅都只保留配置位，真正接入前再按选型实现。

## Analytics

建议从轻量方案开始：Plausible / Umami / Cloudflare Web Analytics / GoatCounter。

环境变量预留：

```env
PUBLIC_ANALYTICS_PROVIDER=
PUBLIC_ANALYTICS_SITE_ID=
PUBLIC_ANALYTICS_SCRIPT_URL=
```

实现原则：

- 只有配置齐全时才在 `Layout.astro` 注入脚本。
- 不在仓库中提交真实站点 ID。
- 默认本地开发不加载统计脚本。

## Comments

两条路线：

1. **Giscus**：低维护，依赖 GitHub Discussions。
2. **PocketBase 自建**：可控，但要处理审核、垃圾内容、限流。

Giscus 环境变量预留：

```env
PUBLIC_GISCUS_REPO=
PUBLIC_GISCUS_REPO_ID=
PUBLIC_GISCUS_CATEGORY=
PUBLIC_GISCUS_CATEGORY_ID=
```

PocketBase 自建评论建议 schema：

| collection | 字段 |
|---|---|
| `comments` | `post_slug`, `author`, `email_hash`, `content`, `status`, `created` |

`status` 建议：`pending` / `approved` / `spam`。

## Email subscription

建议先确定服务商：Buttondown / Resend / Mailchimp / ConvertKit / 自建 PB collection。

环境变量预留：

```env
SUBSCRIBE_PROVIDER=
SUBSCRIBE_API_KEY=
SUBSCRIBE_LIST_ID=
```

实现原则：

- API key 只放服务端环境变量。
- 默认开启 double opt-in。
- 表单必须包含隐私提示和退订说明。
- API 需要限流或最小反垃圾策略。

## i18n

当前站点以中文内容为主。若未来做英文版，优先只国际化 UI 文案；内容多语言需要 PB schema 扩展（如 `title_en`, `content_en`）和 URL 策略确认（如 `/en/...`）。
