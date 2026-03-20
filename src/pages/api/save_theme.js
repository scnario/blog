// src/pages/api/save-theme.js
import fs from 'node:fs';
import path from 'node:path';

export const APIRoute = async ({ request }) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const data = await request.json();
    
    // 【架构警告】如果你想继续用写文件的方式，在 Docker 里必须挂载这个存储路径
    // 否则容器重启配置就没了。这里假设你挂载了一个 /app/data 目录
    const configPath = path.resolve(process.cwd(), './data/theme.json'); 
    
    // 我们不再写 CSS 文件，而是存成 JSON。
    // 前端 BaseLayout.astro 每次渲染时读取这个 JSON 来生成内联 CSS 变量。
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
};