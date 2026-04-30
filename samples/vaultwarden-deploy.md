# Vaultwarden 私有化完全部署指南

> 字段填写指引：
> - **type**: article
> - **slug**: vaultwarden-deploy
> - **tag**: DevOps
> - **emoji**: 🔐
> - **excerpt**: 在自己的 VPS 上用 Docker 部署 Vaultwarden（Bitwarden 兼容服务端），仅需 10MB 内存，解锁全部高级功能，实现绝对的密码数据主权。
> - **is_published**: true
---
# Vaultwarden 私有化部署完全指南

在这个账号密码满天飞、数据泄漏事件频发的时代，把所有密码交给第三方商业公司托管，总让人觉得脖子被别人卡着。为了实现绝对的数据主权，通过 Docker 在自己的 VPS 上部署一个 Vaultwarden，成为了极客们的最终归宿。

## 1. 为什么选择 Vaultwarden？

### 1.1 密码管理的核心痛点
我们每天都在不同设备间切换（iPhone、Mac、Windows、Android），我们需要一个能够跨平台无缝同步、支持自动填充，且绝对安全的密码管理器。1Password 虽然好，但是贵；LastPass 曾经发生过严重的数据泄露。

### 1.2 Vaultwarden 与官方 Bitwarden 的区别
官方的 Bitwarden 后端是使用 C# 编写的，极度消耗内存（官方建议至少 2GB RAM），并且许多高级功能（如安全化验证、TOTP 验证码）需要付费订阅。

而 **Vaultwarden** 是一个由开源社区使用 Rust 语言重写的 Bitwarden 兼容服务端：
* **极其轻量**：运行时仅需 10MB 左右的内存，哪怕是 512MB 内存的廉价小鸡也能轻松跑满。
* **满血解锁**：直接解锁了官方需要付费的全部高级功能。
* **完全兼容**：完美兼容各大平台的官方 Bitwarden 客户端及浏览器插件。

---

## 2. 部署前的准备工作

在开始部署之前，你需要准备好以下基础设施：

### 2.1 基础设施要求
1. **一台 VPS**：无论配置多低，只要能跑 Docker 就行（建议安装 Debian 12 系统）。
2. **一个域名**：将一个子域名（例如 `pwd.yourdomain.com`）解析到这台 VPS 的公网 IP 上。
3. **环境依赖**：服务器已安装 `Docker` 与 `Docker Compose`。

### 2.2 配置 DNS 解析
登录你的域名托管商（如 Cloudflare），添加一条 A 记录：
* **Name**: `pwd`
* **Content**: 你的 VPS IP 地址
* **Proxy status**: 推荐开启小黄云（如果你使用 Cloudflare 代理的话）

---

## 3. Docker Compose 核心部署

为了方便以后的升级和数据备份，我们强烈建议使用 `docker-compose` 来管理服务。

### 3.1 创建目录结构
首先，在服务器上为 Vaultwarden 创建一个独立的工作目录：

```bash
mkdir -p /root/docker/vaultwarden
cd /root/docker/vaultwarden
mkdir -p vw-data
```

### 3.2 编写 docker-compose.yml

```yaml
services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    restart: always
    environment:
      DOMAIN: "https://pwd.yourdomain.com"
      SIGNUPS_ALLOWED: "false"
      ADMIN_TOKEN: "your_strong_random_token_here"
    volumes:
      - ./vw-data:/data
    ports:
      - "127.0.0.1:8080:80"
```

> **安全提示**：`SIGNUPS_ALLOWED: "false"` 关闭公开注册，只保留管理员账号。`ADMIN_TOKEN` 请使用 `openssl rand -base64 48` 生成随机字符串。

### 3.3 启动服务

```bash
docker compose up -d
```

验证容器正常运行：

```bash
docker compose ps
docker compose logs -f vaultwarden
```

---

## 4. 配置反向代理（Nginx）

Vaultwarden 必须运行在 HTTPS 下，这里使用 Nginx + Let's Encrypt 方案。

### 4.1 安装 Certbot

```bash
apt update && apt install -y nginx certbot python3-certbot-nginx
```

### 4.2 申请 SSL 证书

```bash
certbot --nginx -d pwd.yourdomain.com
```

### 4.3 Nginx 配置文件

```nginx
server {
    listen 443 ssl;
    server_name pwd.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/pwd.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pwd.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 支持（Vaultwarden 实时同步需要）
    location /notifications/hub {
        proxy_pass http://127.0.0.1:3012;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name pwd.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

---

## 5. 结语

完成以上配置后，访问 `https://pwd.yourdomain.com` 即可看到 Bitwarden 的登录界面。访问 `https://pwd.yourdomain.com/admin`，使用你设置的 `ADMIN_TOKEN` 进入管理后台，创建你的第一个账号。

随后，在手机/电脑的 Bitwarden 官方客户端"设置 → 自托管 → 服务器地址"中填入你的域名，即可完美无缝地使用这个完全属于你自己的密码管理器。

你的数据，只存在你的服务器上。
