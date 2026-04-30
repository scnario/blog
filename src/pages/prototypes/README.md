# 主题原型归档

`src/pages/prototypes/` 只用于保留主题视觉实验稿，不是生产内容入口。

## 约定

- 生产主题入口在 `src/lib/theme.ts` 注册。
- 全站实际主题 token 在 `src/layouts/Layout.astro` 中维护。
- 原型页可以保留硬编码样式，用于对照视觉方向。
- 不从 TopNav 暴露 `/prototypes`。
- 如果原型被正式采用：先迁移 token / component，再更新 `theme.ts`。

## 当前用途

- 设计回溯
- 新主题试验
- 与生产页面进行视觉对照
