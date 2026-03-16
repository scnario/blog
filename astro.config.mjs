import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: 'hifi-backend',
        configureServer(server) {
          // 1. 保存全局主题
          server.middlewares.use('/api/save-theme', (req, res, next) => {
            if (req.method !== 'POST') return next();
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
              try {
                const body = Buffer.concat(chunks).toString();
                const data = JSON.parse(body);
                const bgUrl = (data.bg && data.bg !== 'none') ? `url('${data.bg}')` : 'none';
                
                const pToggle = data.particles ? 'block' : 'none';
                const avatarM = data.avatarMain ? `url('${data.avatarMain}')` : '';
                const avatarS = data.avatarSub ? `url('${data.avatarSub}')` : '';
                
                const cssContent = `:root {\n  --glass-opacity: ${data.opacity};\n  --glass-bg: rgba(32, 33, 36, var(--glass-opacity));\n  --glass-blur: ${data.blur}px;\n  --toc-text-blur: ${data.toc}px;\n  --text-accent: ${data.color};\n  --bg-image: ${bgUrl};\n  --show-particles: ${pToggle};\n  ${avatarM ? `--avatar-main: ${avatarM};\n` : ''}  ${avatarS ? `--avatar-sub: ${avatarS};\n` : ''}}\n`;
                
                fs.writeFileSync(path.resolve('./src/styles/theme.css'), cssContent);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          });

          // 2. 头像图片安全上传接口
          server.middlewares.use('/api/upload-avatar', (req, res, next) => {
            if (req.method !== 'POST') return next();
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
              try {
                const body = Buffer.concat(chunks).toString();
                const data = JSON.parse(body);
                const targetName = data.target === 'main' ? 'custom-main.jpg' : 'custom-sub.jpg';
                const publicDir = path.resolve('./public/images');
                
                if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
                
                if (data.action === 'upload') {
                  const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, "");
                  const buffer = Buffer.from(base64Data, 'base64');
                  fs.writeFileSync(path.join(publicDir, targetName), buffer);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, path: `/images/${targetName}?t=${Date.now()}` }));
                } else if (data.action === 'delete') {
                  const filePath = path.join(publicDir, targetName);
                  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                }
              } catch (err) {
                console.error('Upload Error:', err);
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          });
        }
      }
    ]
  }
});