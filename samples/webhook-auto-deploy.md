# 纯静态博客完全自动化部署：基于 Webhook + CF Tunnel 的极客实践

> 字段填写指引：
> - **type**: article
> - **slug**: webhook-auto-deploy
> - **tag**: DevOps
> - **emoji**: 🔧
> - **excerpt**: 利用 Cloudflare Tunnel 内网穿透 + Docker Webhook 容器实现"反客为主"的自动化部署，让博客本地 Push 即可自动上线，坚决不暴露 SSH 端口。
> - **is_published**: true
---
# 纯静态博客完全自动化部署：基于 Webhook + CF Tunnel 的极客实践

> 在这个"Serverless"和"CI/CD"满天飞的时代，每次写完文章还要手动 SSH 登录服务器执行 `git pull` 和 `docker compose up -d --build`，简直是对极客精神的亵渎。

为了让我的 Astro + Tailwind CSS 纯静态博客实现"本地 Push，云端自动上线"，同时又**坚决不向外网暴露 VPS 的 SSH 端口**，我摒弃了传统的 GitHub Actions 直连方案，选择了一条极其硬核且极致安全的道路：**利用 Cloudflare Tunnel 内网穿透，配合本地 Docker Webhook 容器实现"反客为主"的自动化部署。**

在这套完美的架构落地前，我踩遍了 Linux 权限、Docker 挂载和 Git 环境的各种"暗坑"。这篇指南，就是为你扫雷的终极兵器。

---

## 1. 为什么选择 Webhook + CF Tunnel？

### 1.1 传统 GitHub Actions 的痛点
主流的 CI/CD 往往要求你把服务器的 SSH 密钥交给第三方，并在防火墙上给 GitHub 的 IP 段开绿灯。这对于追求绝对安全、将所有服务（包括 Vaultwarden 密码管理器）都藏在宿主机内网的强迫症患者来说，是无法接受的。

### 1.2 属于极客的安全架构
* **物理级隔绝**：宿主机不开放任何对外暴露端口，流量全部由 **Cloudflare Zero Trust (Tunnel)** 代理穿透。
* **权限收束本地**：GitHub 只负责发送一个简单的 HTTP POST 信号，真正的拉取代码和 Docker 容器重启权限，全部紧紧握在服务器本地的 Webhook 容器手里。

---

## 2. 踩坑实录：那些令容器崩溃的幽灵

在跑通整个流程的过程中，Docker 容器的黑盒特性给我上了生动的一课。

### 2.1 坑一：Alpine 镜像的权限陷阱 (`Permission Denied`)
官方的 `almir/webhook` 镜像基于极简的 Alpine Linux，出于安全考虑默认使用了降级的非 `root` 用户。如果直接挂载宿主机的配置文件，或者尝试在容器内执行 `apk add` 安装软件，会直接遭遇权限拒绝。
* **🚀 破局**：必须自己编写一个 `Dockerfile`，在 `FROM` 之后强行声明 `USER root`。

### 2.2 坑二：徒手劈砖的"光杆司令" (`Missing Tools`)
Webhook 容器本身是一个极度纯净的环境。当它收到 GitHub 的信号准备大干一场时，会尴尬地发现自己既没有 `git`，也无法调用宿主机的 `docker`。
* **🚀 破局**：在自定义的 `Dockerfile` 中，手动注入灵魂环境：
  ```bash
  apk add --no-cache git docker-cli docker-cli-compose bash openssh
  ```

### 2.3 坑三：Git 的安全限制与 SSH 迷失
哪怕装了 Git，由于部署脚本是在 Docker 挂载的目录中执行的，较新的 Git 会触发安全机制直接罢工（提示 `fatal: unsafe repository`）。同时，如果代码使用 SSH 协议拉取，容器内部会因为缺少宿主机的 SSH 密钥再次崩溃。
* **🚀 破局**：
  1. 将宿主机的 `/root/.ssh` 以只读 (`:ro`) 模式挂载进容器。
  2. 在部署脚本的第一步加入全局免检配置：`git config --global --add safe.directory '*'`。

### 2.4 坑四：Docker 挂载恶作剧 (`Is a directory`)
千万不要试图把宿主机上**不存在的文件**挂载进容器！如果你在 `docker-compose.yml` 中写了挂载 `.gitconfig`，而宿主机上刚好没有这个文件，Docker 会"贴心"地帮你建一个同名的**空文件夹**。结果 Git 读取配置时直接闪退，报出 `Resource busy`。
* **🚀 破局**：去掉不必要的文件挂载，或者确保挂载前宿主机上的文件已真实存在。

---

## 3. 终极部署配置清单

经过反复淬炼，以下是完美运行的四大核心配置文件。

### 3.1 改造版 Dockerfile
在 `/root/webhook/` 目录下创建，用于赋予 Webhook 容器终极权限：

```dockerfile
FROM almir/webhook:latest

# 强制获取最高权限
USER root

# 安装 Git、Docker 客户端、Compose 插件及 SSH 工具
RUN apk update && apk add --no-cache git docker-cli docker-cli-compose bash openssh
```

### 3.2 容器编排 docker-compose.yml
在 `/root/webhook/` 目录下创建，打通宿主机与容器的"传送门"：

```yaml
services:
  webhook:
    build: .
    container_name: github-webhook
    restart: always
    ports:
      - "9000:9000"
    volumes:
      - ./hooks.json:/etc/webhook/hooks.json
      - /root/blog:/root/blog
      - /var/run/docker.sock:/var/run/docker.sock
      - /root/.ssh:/root/.ssh:ro
    command: -verbose -hooks=/etc/webhook/hooks.json -hotreload
```

### 3.3 触发器规则 hooks.json
在 `/root/webhook/` 目录下创建：

```json
[
  {
    "id": "rebuild-blog",
    "execute-command": "/root/blog/deploy.sh",
    "command-working-directory": "/root/blog"
  }
]
```

### 3.4 钢铁般的执行脚本 deploy.sh
放在博客根目录下 (`/root/blog/deploy.sh`)：

```bash
#!/bin/bash
cd /root/blog

echo "================ $(date) ================"
echo "Starting deployment..."

echo "--> Configuring Git safe directory..."
git config --global --add safe.directory '*'

echo "--> Pulling latest code..."
git fetch --all
git reset --hard origin/main
git pull origin main

echo "--> Building new Docker image..."
docker compose up -d --build

echo "--> Cleaning up..."
docker image prune -f

echo "--> Deployment finished successfully!"
```

---

## 4. 结语

最后，在 Cloudflare Tunnel 将 `webhook.yourdomain.com` 穿透映射到本地 `9000` 端口，并在 GitHub 的 Webhook 设置中填入 URL（格式务必选择 `application/json`）后，整条链路便彻底打通。

现在，我只需要在本地炫酷的 `/console` 面板调好参数，在终端优雅地敲下 `git push`，剩下的拉取、打包、构建、重启，全在十几秒内由远端服务器默默完成。

**这，才是属于赛博时代的硬核浪漫。**
