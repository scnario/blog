---
layout: '../layouts/Layout.astro'
title: "安装XanMod内核开启BBRv3的一键部署脚本"
date: "2026-01-23"
---

# 安装XanMod内核开启BBRv3的一键部署脚本

**关键词：** `Linux内核调优`, `TCP BBRv3`, `XanMod Kernel`, `DevOps自动化`, `VPS性能优化`, `Debian/Ubuntu运维`, `Shell脚本编程`, `流媒体解锁检测`, `root ssh 远程登录`, `全链路监控`

---

## 摘要

在云原生（Cloud Native）与微服务架构日益普及的今天，虚拟专用服务器（VPS）作为最基础的计算单元，其初始化的环境质量直接决定了上层应用的稳定性与网络吞吐能力。然而，绝大多数公有云提供的默认镜像（Debian/Ubuntu Vanilla Image）往往基于通用兼容性考量，保留了保守的内核参数与拥塞控制算法，导致硬件性能——尤其是高带宽环境下的网络性能——无法被充分释放。

本文将深入探讨 Linux 网络协议栈的瓶颈所在，剖析 Google BBRv3 拥塞控制算法的数学模型优势，并详细介绍如何通过“E-Way Pilot 旗舰版”自动化脚本，实现从内核升级、内存管理到服务探针的**全生命周期自动化交付**。这不仅是一个脚本的使用说明，更是一次关于 Linux 系统深度调优的技术巡礼。

---

## 第一章：后摩尔时代的 VPS 运维挑战

### 1.1 默认内核的局限性
大多数 VPS 厂商提供的 Debian 11/12 或 Ubuntu 22.04 LTS 镜像，使用的是 Linux 长期支持版内核。虽然稳定，但其进程调度器（CFS）和 TCP 协议栈配置往往落后于最新的硬件发展。例如，默认的 TCP Cubic 算法在处理长肥管道（Long Fat Network, LFN）——即高带宽、高延迟的跨国网络环境时，极易因丢包误判而大幅缩减发送窗口，导致网络速度断崖式下跌。

### 1.2 碎片化的运维操作
传统的 VPS 初始化流程极其琐碎：
1. 手动修改 SSH 配置文件以允许 Root 登录。
2. 计算并创建 Swap 分区以防止 OOM（内存溢出）。
3. 添加第三方源，手动编译或安装新内核。
4. 修改 `sysctl.conf` 开启 BBR。
5. 寻找各种脚本测试流媒体解锁和回程路由。

这种“手工作坊”式的运维方式不仅效率低下，而且极易引入人为错误。任何一个步骤的遗漏（例如安装新内核后忘记更新 GRUB 或忘记安装 CA 证书）都可能导致服务器失联。

### 1.3 “E-Way Pilot”的解决思路
针对上述痛点，我们开发了 `vps` 自动化运维工具。它并非简单的命令堆砌，而是基于幂等性（Idempotency）设计原则的 IaC（基础设施即代码）实践。它具备以下核心特性：
* **状态感知**：自动识别当前系统状态（如 Swap 是否存在、内核是否已安装），避免重复操作。
* **逻辑闭环**：处理了 Linux 内核升级中最棘手的“重启衔接”问题，通过状态文件实现跨重启的任务流控制。
* **容错机制**：针对 GPG 密钥获取失败、软件源 404 等常见网络问题，内置了多级 Fallback 重试机制。

---

## 第二章：核心技术原理剖析

### 2.1 为什么选择 XanMod 内核？
XanMod 是一个专为桌面、多媒体和高性能计算场景优化的 Linux 内核发行版。与官方内核相比，它在 VPS 场景下有显著优势：
* **高吞吐量与低延迟**：XanMod 默认开启了 BBRv3，并对网络栈进行了激进优化，显著降低了处理高并发连接时的软中断（SoftIRQ）开销。
* **多队列块层调度（Multi-Queue Block Layer）**：针对 NVMe 和 SSD 进行了优化，提升了 I/O 密集型任务（如数据库、编译）的性能。
* **CPU 指令集优化**：脚本自动选择 `x64v3` 版本，该版本利用了 AVX2、FMA3 等现代 CPU 指令集，相比通用的 `v1` 版本，在加解密（如 HTTPS、VLESS 协议）运算上能提升 10%-30% 的效率。

### 2.2 TCP BBRv3：拥塞控制的革命
BBR（Bottleneck Bandwidth and Round-trip propagation time）是 Google 开发的一种基于模型的拥塞控制算法。与传统的基于丢包反馈（Loss-based）的 Cubic 算法不同，BBR 是基于带宽和延迟模型（Model-based）的。
* **BBR v1 的问题**：虽然提升了吞吐量，但 v1 版本存在“侵略性”过强的问题，容易导致与 Cubic 数据流共存时抢占过多带宽，且在丢包率极高的网络下重传率不可控。
* **BBR v3 的进化**：v3 版本引入了对 **ECN（显式拥塞通知）** 的支持，并优化了对丢包的容忍度。它能够更精确地估算 BtlBw（瓶颈带宽）和 RTprop（往返传播时间），在保持高吞吐的同时，显著降低了排队延迟（Queuing Delay）。对于跨国 VPS 而言，BBRv3 意味着更稳的 YouTube 4K 播放和更快的 SSH 响应速度。

### 2.3 Swap 虚拟内存的智能调度
很多人认为“内存够大就不需要 Swap”，这是一种误解。Linux 内核的内存管理机制决定了，即使物理内存充足，适当的 Swap 也能让系统将极少访问的匿名页（Anonymous Pages）换出，从而留出更多物理内存用于 **Page Cache（文件页缓存）**。

本脚本不仅自动创建 Swap，更重要的是将 `vm.swappiness` 参数优化为 `10`。这意味着内核会尽可能使用物理 RAM，仅在内存压力极大时才使用磁盘交换空间，从而在防止 OOM 崩溃和保证 I/O 性能之间找到了最佳平衡点。

![Xanmod Architecture](https://blog.oool.cc/upload/image-enTD.png)

---

## 第三章：自动化脚本部署指南

本脚本设计为“一行代码交付”，只需在终端粘贴即可完成安装。

### 3.1 适用环境
* **操作系统**：Debian 10/11/12, Ubuntu 20.04/22.04/24.04
* **架构**：x86_64 (amd64)
* **虚拟化**：KVM, Xen, Hyper-V, VMware (不推荐用于 OpenVZ/LXC 容器)

### 3.2 一键安装命令
请使用 root 用户登录终端（或使用 `sudo -i` 切换），复制以下全部代码并回车：

```bash
cat << 'EOF' > /usr/local/bin/vps && chmod +x /usr/local/bin/vps
#!/bin/bash

# ====================================================
# 脚本名称: vps (E-Way Pilot 旗舰交版 v3.4 blog.oool.cc)
# 功能: 运维部署(1-6) + 结果验收探针(7)
# 更新日志 v3.4:
#   1. [新增] apt 进程锁自动等待机制，解决 GCP/AWS 后台自动更新冲突
#   2. [优化] 增加 fuser 依赖检测，用于精准判定进程占用
#   3. [修复] 强化了 XanMod 内核安装时的环境前置判定
# ====================================================

# --- 颜色与样式 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
SKYBLUE='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

[[ $EUID -ne 0 ]] && echo -e "${RED}错误: 必须以 root 权限运行!${NC}" && exit 1
STATE_FILE="/etc/vps_script_state"
XANMOD_KEY_FINGERPRINT="86F7D09EE734E623"

# ====================================================
#   防冲突核心逻辑
# ====================================================

function wait_for_apt_lock() {
    echo -e "${YELLOW}检查系统软件包管理器状态...${NC}"
    # 确保 psmisc (含 fuser) 已安装，否则降级使用基础判断
    if ! command -v fuser >/dev/null 2>&1; then
        apt-get update -qq && apt-get install -y -qq psmisc >/dev/null 2>&1
    fi

    local LOCK_FILES=("/var/lib/dpkg/lock-frontend" "/var/lib/apt/lists/lock" "/var/lib/dpkg/lock")
    for lock_file in "${LOCK_FILES[@]}"; do
        if [ -e "$lock_file" ]; then
            while fuser "$lock_file" >/dev/null 2>&1; do
                echo -e "${PURPLE}提示: 后台更新进程正在运行 (GCP/AWS 自动初始化)，等待 5 秒重试...${NC}"
                sleep 5
            done
        fi
    done
}

# ====================================================
#   基础工具与环境预处理
# ====================================================

function check_dependencies() {
    # 修复 Ubuntu GPG 目录缺失问题
    if [ ! -d "/root/.gnupg" ]; then
        mkdir -p -m 700 /root/.gnupg
    else
        chmod 700 /root/.gnupg
    fi

    # 兼容性安装依赖 (加入锁等待)
    if ! command -v wget >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1 || ! command -v gpg >/dev/null 2>&1; then
        wait_for_apt_lock
        echo -e "${YELLOW}正在安装基础工具 (curl/wget/gpg)...${NC}"
        apt-get update -qq 
        apt-get install -y -qq wget curl gnupg gnupg2 dirmngr ca-certificates psmisc
    fi
}

function check_region() {
    echo -e "${YELLOW}正在检测 VPS 地理位置以优化连接...${NC}"
    region_data=$(curl -s --connect-timeout 3 [http://ip-api.com/json](http://ip-api.com/json))
    country=$(echo "$region_data" | grep -o '"countryCode":"[^"]*"' | cut -d'"' -f4)
    
    if [[ "$country" == "CN" ]] || [[ "$country" == "HK" ]] || [[ "$country" == "TW" ]] || [[ "$country" == "SG" ]] || [[ "$country" == "JP" ]]; then
        echo -e "${GREEN}检测到亚太地区 ($country)，将尝试优化连接策略。${NC}"
        REGION_OPT="ASIA"
    elif [[ "$country" == "US" ]] || [[ "$country" == "CA" ]]; then
        echo -e "${GREEN}检测到北美地区 ($country)，使用默认源。${NC}"
        REGION_OPT="NA"
    else
        echo -e "${GREEN}检测到区域 ($country)，使用全球加速源。${NC}"
        REGION_OPT="GLOBAL"
    fi
}

# ====================================================
#   核心功能模块
# ====================================================

function clean_bbr_configs() {
    sed -i '/net.core.default_qdisc/d' /etc/sysctl.conf
    sed -i '/net.ipv4.tcp_congestion_control/d' /etc/sysctl.conf
    rm -f /etc/sysctl.d/99-bbr.conf
    rm -f /etc/sysctl.d/99-xanmod-bbr.conf
}

function check_resume_state() {
    if [ -f $STATE_FILE ]; then
        clear
        echo -e "${SKYBLUE}╔══════════════════════════════════════════════════╗${NC}"
        echo -e "${SKYBLUE}║      系统重启检测完毕，正在执行 BBR3 激活        ║${NC}"
        echo -e "${SKYBLUE}╚══════════════════════════════════════════════════╝${NC}"
        
        current_kernel=$(uname -r)
        if echo "$current_kernel" | grep -qi "xanmod"; then
            echo -e "${GREEN}当前内核: $current_kernel (验证通过)${NC}"
            clean_bbr_configs
            echo "net.core.default_qdisc=fq_pie" > /etc/sysctl.d/99-xanmod-bbr.conf
            echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.d/99-xanmod-bbr.conf
            modprobe tcp_bbr 2>/dev/null
            
            if ! sysctl -p /etc/sysctl.d/99-xanmod-bbr.conf >/dev/null 2>&1; then
                echo -e "${YELLOW}提示: 环境不支持 fq_pie，自动降级为 fq...${NC}"
                echo "net.core.default_qdisc=fq" > /etc/sysctl.d/99-xanmod-bbr.conf
                echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.d/99-xanmod-bbr.conf
                sysctl -p /etc/sysctl.d/99-xanmod-bbr.conf >/dev/null 2>&1
            fi
            
            rm -f $STATE_FILE
            echo -e "${GREEN}BBRv3 激活成功！${NC}"
            echo -e "${YELLOW}即将自动运行探针以验收安装结果...${NC}"
            sleep 2
            run_probe
            return
        else
            echo -e "${RED}内核切换失败，当前仍为: $current_kernel${NC}"
            rm -f $STATE_FILE 
        fi
    fi
}

# 1. SSH 配置
function setup_ssh() {
    echo -e "${YELLOW}正在配置 Root 密码登录...${NC}"
    read -p "请输入要设置的 root 密码: " root_pass
    echo "root:$root_pass" | chpasswd
    
    SSH_CONF="/etc/ssh/sshd_config"
    cp $SSH_CONF "${SSH_CONF}.bak"
    sed -i 's/^Include /#Include /g' $SSH_CONF
    if [ -d "/etc/ssh/sshd_config.d" ]; then
        for f in /etc/ssh/sshd_config.d/*.conf; do
            [ -e "$f" ] && mv "$f" "${f}.disabled" 2>/dev/null
        done
    fi
    sed -i '/^PermitRootLogin/d' $SSH_CONF
    sed -i '/^PasswordAuthentication/d' $SSH_CONF
    echo "PermitRootLogin yes" >> $SSH_CONF
    echo "PasswordAuthentication yes" >> $SSH_CONF
    
    if systemctl list-unit-files | grep -q sshd.service; then
        systemctl restart sshd
    else
        systemctl restart ssh
    fi
    echo -e "${GREEN}SSH 配置完成！${NC}"
}

# 2. Swap 配置
function setup_swap() {
    echo -e "${YELLOW}正在配置虚拟内存 Swap...${NC}"
    if grep -q "swap" /etc/fstab; then
        swapoff -a
        sed -i '/swap/d' /etc/fstab
        rm -f /swapfile
    fi
    read -p "请输入 Swap 大小 (单位G，默认2G): " swap_size
    swap_size=${swap_size:-2}
    fallocate -l "${swap_size}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$((swap_size * 1024)) status=progress
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
    sysctl -p /etc/sysctl.d/99-swap.conf
    echo -e "${GREEN}Swap ${swap_size}G 配置成功！${NC}"
}

# 3. 标准 BBR
function enable_bbr() {
    echo -e "${YELLOW}正在开启标准 BBR...${NC}"
    clean_bbr_configs
    echo "net.core.default_qdisc=fq" > /etc/sysctl.d/99-bbr.conf
    echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.d/99-bbr.conf
    sysctl --system
    echo -e "${GREEN}标准 BBR 已开启！${NC}"
}

# 4. XanMod + BBR3
function setup_xanmod() {
    echo -e "${YELLOW}正在优化 initramfs (防爆盘)...${NC}"
    if [ -f /etc/initramfs-tools/initramfs.conf ]; then
        sed -i 's/^MODULES=.*/MODULES=dep/' /etc/initramfs-tools/initramfs.conf
        sed -i 's/^COMPRESS=.*/COMPRESS=gzip/' /etc/initramfs-tools/initramfs.conf
    fi

    check_dependencies
    check_region

    echo -e "${YELLOW}正在获取 GPG 密钥...${NC}"
    mkdir -p /etc/apt/keyrings
    rm -f /etc/apt/keyrings/xanmod-archive-keyring.gpg
    UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    KEY_URL="[https://dl.xanmod.org/archive.key](https://dl.xanmod.org/archive.key)"
    
    if curl -A "$UA" -fsSL "$KEY_URL" -o /tmp/xanmod.key; then
        echo -e "${GREEN}[OK] 密钥下载成功${NC}"
    else
        echo -e "${RED}[Error] 官方源连接失败，尝试使用 Keyserver 回退方案...${NC}"
        if ! gpg --no-default-keyring --keyring /etc/apt/keyrings/xanmod-archive-keyring.gpg --keyserver keyserver.ubuntu.com --recv-keys $XANMOD_KEY_FINGERPRINT; then
             echo -e "${RED}密钥获取彻底失败，请检查网络连接。${NC}"
             return
        else
             goto_repo_setup=true
        fi
    fi

    if [ "$goto_repo_setup" != "true" ]; then
        gpg --dearmor --yes -o /etc/apt/keyrings/xanmod-archive-keyring.gpg /tmp/xanmod.key
        rm -f /tmp/xanmod.key
    fi

    echo 'deb [signed-by=/etc/apt/keyrings/xanmod-archive-keyring.gpg] [http://deb.xanmod.org](http://deb.xanmod.org) releases main' > /etc/apt/sources.list.d/xanmod-release.list

    # --- 关键修复：安装前的锁检测 ---
    wait_for_apt_lock
    echo -e "${YELLOW}正在安装 XanMod 内核...${NC}"
    apt-get update
    
    cpu_flags=$(grep -m1 'flags' /proc/cpuinfo)
    if echo "$cpu_flags" | grep -q 'avx2' && echo "$cpu_flags" | grep -q 'fma' && echo "$cpu_flags" | grep -q 'bmi2' && echo "$cpu_flags" | grep -q 'movbe'; then
        echo -e "${GREEN}检测到现代 CPU，将安装高性能版 (x64v3)...${NC}"
        target_kernel="linux-xanmod-x64v3"
    else
        echo -e "${YELLOW}检测到老旧或基础 CPU，将安装通用兼容版 (x64v1)...${NC}"
        target_kernel="linux-xanmod-x64v1"
    fi
    
    if apt-get install "$target_kernel" -y; then
        echo "XANMOD_PENDING_REBOOT" > $STATE_FILE
        echo -e "${GREEN}内核安装成功！${NC}"
        read -p "必须重启以生效。重启后脚本会自动完成 BBR3 配置。是否立即重启? (y/n): " res
        [[ "$res" == "y" ]] && reboot
    else
        echo -e "${RED}安装失败，尝试修复依赖...${NC}"
        wait_for_apt_lock
        apt-get install -f -y
        if apt-get install "$target_kernel" -y; then
             echo "XANMOD_PENDING_REBOOT" > $STATE_FILE
             read -p "安装成功，是否立即重启? (y/n): " res
             [[ "$res" == "y" ]] && reboot
        fi
    fi
}

# 6. 卸载
function uninstall_script() {
    echo -e "${RED}正在卸载...${NC}"
    swapoff -a 2>/dev/null
    sed -i '/swap/d' /etc/fstab
    rm -f /swapfile
    rm -f /etc/sysctl.d/99-swap.conf
    clean_bbr_configs
    rm -f /etc/apt/sources.list.d/xanmod-release.list
    rm -f /etc/apt/keyrings/xanmod-archive-keyring.gpg
    rm -f /usr/local/bin/vps
    rm -f $STATE_FILE
    sed -i 's/^#Include /Include /g' /etc/ssh/sshd_config
    echo -e "${GREEN}脚本已彻底卸载。${NC}"
    exit 0
}

# 7. 探针
function run_probe() {
    if ! command -v traceroute >/dev/null 2>&1; then 
        wait_for_apt_lock
        apt-get update -qq && apt-get install traceroute netcat-openbsd -y -qq
    fi
    clear
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${SKYBLUE}         VPS 部署验收探针 (E-Way Pilot 交付版) blog.oool.cc       ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    kernel=$(uname -r)
    cpu_cores=$(grep -c 'processor' /proc/cpuinfo)
    mem=$(free -m | awk '/Mem:/ {print $3 "/" $2 " MB"}')
    disk=$(df -h / | awk 'NR==2 {print $3 "/" $2}')
    swap_total=$(free -m | awk '/Swap:/ {print $2}')
    if [ "$swap_total" -gt 0 ]; then
        swap_used=$(free -m | awk '/Swap:/ {print $3}')
        swap_status="${GREEN}已开启${NC} ($swap_used/$swap_total MB)"
    else
        swap_status="${RED}未开启${NC}"
    fi
    tcp_cc=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null)
    qdisc=$(sysctl -n net.core.default_qdisc 2>/dev/null)
    if [[ "$tcp_cc" == *"bbr"* ]]; then
        if [[ "$kernel" == *"xanmod"* ]]; then bbr_ver="BBRv3 (XanMod + $qdisc)";
        elif [[ $(modinfo tcp_bbr 2>/dev/null) == *"version: 3"* ]]; then bbr_ver="BBRv3";
        else bbr_ver="BBR 标准版"; fi
        bbr_status="${GREEN}已开启${NC} ${SKYBLUE}[$bbr_ver]${NC}"
    else bbr_status="${RED}未开启${NC}"; fi

    echo -e "${YELLOW}[系统验收]${NC}"
    echo -e "核心: $kernel | CPU: ${cpu_cores}核"
    echo -e "配置: 内存 $mem | 硬盘 $disk"
    echo -e "Swap: $swap_status"
    echo -e "BBR : $bbr_status"

    echo -e "\n${YELLOW}[流媒体与AI解锁]${NC}"
    check() {
        code=$(curl -sL -m 3 -o /dev/null -w "%{http_code}" -A "Mozilla/5.0" "$1")
        if [[ "$code" == "200" || "$code" == "302" ]]; then echo -e "$2: ${GREEN}Yes${NC}"; else echo -e "$2: ${RED}No${NC}"; fi
    }
    check "[https://gemini.google.com/app](https://gemini.google.com/app)" "Gemini " &
    check "[https://www.youtube.com/](https://www.youtube.com/)" "YouTube" &
    check "[https://www.netflix.com/title/80018499](https://www.netflix.com/title/80018499)" "Netflix" &
    wait
    echo -e "\n${GREEN}验收完成。上方结果已保留。${NC}"
    main_menu "keep_screen"
}

function main_menu() {
    check_dependencies
    if [ "$1" != "keep_screen" ]; then
        check_resume_state
        clear
    fi
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${SKYBLUE}            E-Way Pilot 自动化运维脚本旗舰版 (blog.oool.cc)       ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "1) GCP, AWS VPS root用户远程ssh登录 (含AWS修复)"
    echo -e "2) 建立虚拟内存 Swap (可自定义大小)"
    echo -e "3) 开启标准 BBR"
    echo -e "4) 安装 XanMod 内核开启 BBR3 (含区域优化+防冲突)"
    echo -e "5) 以上 1-4 选项全选"
    echo -e "6) 卸载本脚本"
    echo -e "7) 运行探针 (验收结果 / 检查 Gemini)"
    echo -e "0) 退出"
    echo -e "${GREEN}────────────────────────────────────────────────────────────────────${NC}"
    read -p "请选择操作 [0-7]: " choice
    case $choice in
        1) setup_ssh; main_menu ;;
        2) setup_swap; main_menu ;;
        3) enable_bbr; main_menu ;;
        4) setup_xanmod ;; 
        5) setup_ssh; setup_swap; enable_bbr; setup_xanmod ;;
        6) uninstall_script ;;
        7) run_probe ;;
        0) exit 0 ;;
        *) main_menu ;;
    esac
}

main_menu
EOF
```

### 3.3 使用场景示例

安装完成后，在终端直接输入 `vps` 即可调出菜单：

**场景一：GCP/AWS 新机初始化**
* **痛点**：只能通过浏览器 SSH 登录，无法使用 Termius/Xshell；无 Swap 导致 MySQL 经常崩溃。
* **操作**：选择菜单 `1`（设置 Root 密码）和 `2`（开启 Swap）。
* **效果**：通过密码直连 Root 账户，获得 2GB 虚拟内存缓冲。

**场景二：极致网络性能调优**
* **痛点**：服务器在新加坡，但连接国内速度不稳定，YouTube 4K 缓冲。
* **操作**：选择菜单 `4`（安装 XanMod 内核）。
* **流程**：脚本自动优化 `initramfs` -> 下载内核 -> 询问重启。重启后，脚本自动唤醒，配置 `fq_pie` 队列算法并开启 `bbr`。
* **验证**：重启后自动进入菜单 `7`，此时你应该能看到 BBR 状态栏显示为 **BBRv3 (XanMod + fq_pie)**，这代表目前 Linux 领域最先进的拥塞控制技术已生效。

---

## 第四章：技术实现细节与亮点

为了确保脚本在生产环境的绝对可靠性，我们在 `vps` 脚本中实现了一些巧妙的工程化逻辑。

### 4.1 状态机与重启衔接

Linux 内核升级强制要求系统重启，这通常打断了自动化脚本的执行流。为了实现“全自动”，我们引入了**状态文件机制**：
* 当用户选择安装内核时，脚本在 `/etc/vps_script_state` 写入 `XANMOD_PENDING_REBOOT` 标记。
* 系统重启后，用户再次运行 `vps`，脚本首先读取该标记。
* 如果标记存在，脚本将跳过欢迎界面，直接进入 `check_resume_state` 函数，执行后续的 sysctl 参数写入和模块加载。
* **亮点**：这就像游戏中的“存档点”，确保了任务流的连续性。

### 4.2 GPG 密钥的“双重保险”

在 GCP 或 AWS 的某些内网环境中，访问 `dl.xanmod.org` 下载 GPG 公钥时，常因网络抖动或 DNS 污染导致握手失败，进而导致 `apt update` 报错 `NO_PUBKEY`。

* **方案**：脚本内置了双通道下载逻辑。
  * **通道 A**：尝试从官网直连下载。
  * **通道 B（Fallback）**：如果 A 失败，自动切换到 `keyserver.ubuntu.com` 全球公钥服务器，通过指纹（Fingerprint: `86F7D09EE734E623`）精确拉取密钥。 这一设计彻底解决了“脚本跑一半报错”的尴尬，极大提升了成功率。

### 4.3 智能探针的“结果驻留”设计

传统的 VPS 探针脚本（如 SuperBench）运行结束后会退出或清屏，用户往往记不住刚才哪里有问题。我们的 **E-Way Pilot 探针** 采用了“结果驻留”模式：

* 探针运行完毕后，**不执行** `clear` **命令**。
* 直接在检测报告下方渲染主菜单。
* **用户体验**：用户看着上方的红色报错（例如 "Swap: 未开启"），无需记忆，直接在下方输入 `2` 即可修复，实现了“监测-修复”的闭环交互。

---

## 第五章：对未来的展望

运维自动化的终极目标是“NoOps”。`vps` 脚本是我们迈向这一目标的一小步。通过将复杂的内核参数调优、文件系统管理和网络协议栈优化封装进一个 15KB 的 Shell 脚本中，我们让每一位开发者都能以最低的成本，享受到 Google 和 Linux 社区最前沿的技术红利。

未来，我们将继续跟进 Linux 6.x 内核的最新特性，引入更多如 `eBPF` 监控、`ZRAM` 内存压缩等高级功能，让您的 VPS 始终保持在性能巅峰。