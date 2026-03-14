---
layout: ../layouts/Layout.astro
title: Vaultwarden 部署记录
---

<article class="hifi-card w-full max-w-3xl mx-auto my-10">

# Vaultwarden 私有化部署

为了在手机和电脑之间安全地同步密码，我决定在只装了 Docker 的服务器上跑一个 Rust 版本的 Bitwarden（也就是 Vaultwarden）。

## 1. 启动容器

下面是我使用的启动命令，注意映射好数据目录：

```bash
# 拉取最新镜像并后台运行
docker run -d --name vaultwarden \
  -e WEBSOCKET_ENABLED=true \
  -v /vw-data/:/data/ \
  -p 80:80 \
  -p 3012:3012 \
  vaultwarden/server:latest