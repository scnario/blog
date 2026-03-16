---
layout: '../layouts/Layout.astro'
title: "Vaultwarden 私有化部署完全指南"
date: "2026-03-16"
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
# 创建应用目录
mkdir -p /root/docker/vaultwarden
cd /root/docker/vaultwarden

# 创建数据存储目录
mkdir -p vw-data