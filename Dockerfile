# --- 构建阶段 ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# 这里执行 astro build 时，因为配了 output: 'server'，它会编译出一个 Node.js 服务端程序
RUN npm run build

# --- 运行阶段 ---
FROM node:22-alpine AS runner
WORKDIR /app
# 设置为生产环境
ENV NODE_ENV=production
# 设置主机和端口，匹配你 docker-compose 里的 8080 映射
ENV HOST=0.0.0.0
ENV PORT=80

# 只拷贝构建好的产物和 node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 80

# 启动 Astro 的动态服务端程序
CMD ["node", "./dist/server/entry.mjs"]