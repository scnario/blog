import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  // 必须显式声明为服务端渲染
  output: 'server', 
  
  vite: {
    plugins: [
      tailwindcss(),
      // 那个 hifi-backend 插件已经被移除了，我们要走正规军路线
    ]
  },

  adapter: node({
    mode: 'standalone'
  })
});