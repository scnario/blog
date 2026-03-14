# === 阶段一：使用 Node 构建静态文件 ===
FROM node:20-alpine AS builder
WORKDIR /app

# 复制 package.json 并安装依赖
COPY package*.json ./
RUN npm install

# 复制所有源代码并执行 Astro 编译
COPY . .
RUN npm run build

# === 阶段二：使用 Nginx 极速托管 ===
FROM nginx:alpine

# 将阶段一编译好的纯静态文件 (dist目录) 复制到 Nginx 的默认托管目录下
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露 80 端口（容器内部端口）
EXPOSE 80

# 以前台模式启动 Nginx
CMD ["nginx", "-g", "daemon off;"]