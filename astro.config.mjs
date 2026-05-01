import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://showcase.91917788.xyz',
  output: 'server',

  // 旧 .md 路由 → 新 /articles/<slug> 301 重定向
  // 迁移完成后删除 src/pages/*.md，这里保留即可
  redirects: {
    '/create_blog': '/articles/webhook-auto-deploy',
    '/vaultwarden': '/articles/vaultwarden-deploy',
    '/xmod':        '/articles/xanmod-bbrv3',
  },

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({ mode: 'standalone' })
});
