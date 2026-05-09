# 🚀 Embodied Marketing - 部署配置手册

> **最后更新**: 2026-05-09  
> **维护者**: Aramis Jiang  
> **GitHub**: https://github.com/aramisjiang-wq/embodied-marketing

---

## 📋 目录

- [项目概述](#项目概述)
- [服务器架构](#服务器架构)
- [访问地址](#访问地址)
- [飞书认证配置](#飞书认证配置)
- [部署方式](#部署方式)
- [日常运维](#日常运维)
- [安全加固](#安全加固)
- [故障排查](#故障排查)

---

## 项目概述

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端框架** | Next.js (App Router) | 16.2.4 |
| **UI库** | React | 19.2.4 |
| **语言** | TypeScript | 5.x |
| **样式** | Tailwind CSS | 4.x |
| **数据库** | SQLite (better-sqlite3) | - |
| **图表** | Recharts | 3.8.1 |
| **后端采集** | Python 3.11 | - |
| **认证** | 飞书 OAuth2 | - |

### 核心功能

- ✅ B站品牌竞品监控与分析
- ✅ 多维度数据对比（播放量/点赞/收藏/评论）
- ✅ 趋势图表与热力图可视化
- ✅ 定时自动数据采集（每天凌晨00:05）
- ✅ 飞书企业账号登录
- ✅ 用户权限管理（admin/editor/viewer）

---

## 服务器架构

### 当前部署状态（⚠️ 重要）

```
服务器: 101.200.222.139 (阿里云ECS Ubuntu)
├── 端口分配:
│   ├── :80   → Nginx 反向代理
│   ├── :443  → Nginx SSL (未启用)
│   ├── :3000 → Docker容器: embodied-map-pro ⚠️ (旧项目)
│   └── :3001 → ❌ 未部署 (计划给 Embodied Marketing)
│
├── 运行中的服务:
│   ├── Nginx (反向代理)
│   ├── embodied-map-pro (Docker) ← 当前 :80 指向这里
│   ├── feishu2md (:8081)
│   ├── monitor.py (:8082)
│   └── Glances 监控 (:61208)
│
└── 目录结构:
    ├── /opt/bilibili-monitor/     (其他产品)
    ├── /opt/embodied-marketing/   (❌ 尚未创建)
    └── /var/lib/docker/           (Docker数据)
```

### ⚠️ 关键问题说明

**问题**: 访问 `http://101.200.222.139/` 显示的是 **Embodied Map**（旧项目），不是 Embodied Marketing（新项目）

**原因**:
- Nginx 的默认配置将 80 端口转发到 `127.0.0.1:3000`
- 3000 端口运行的是旧的 Docker 容器 `embodied-map-pro`
- 新的 Embodied Marketing 项目**尚未正式部署到服务器**

---

## 访问地址

### 当前可用的地址

| 服务 | URL | 状态 |
|------|-----|------|
| **旧项目 (Embodied Map)** | http://101.200.222.139 | ✅ 运行中 |
| **旧项目直连** | http://101.200.222.139:3000 | ✅ 运行中 |
| **系统监控** | http://101.200.222.139:61208 | ✅ 可用 |

### 🎯 新项目部署后的地址（待实施）

| 服务 | URL | 说明 |
|------|-----|------|
| **Web 应用** | http://101.200.222.139:3001 | 新端口 |
| **或通过Nginx** | http://101.200.222.139/marketing/ | 子路径方案 |
| **飞书回调** | http://101.200.222.139:3001/api/auth/callback | OAuth2 重定向 |

---

## 飞书认证配置

### 必需的配置项

在[飞书开放平台](https://open.feishu.cn/app)创建企业自建应用：

#### 1. 应用基本信息

```
应用名称: Embodied Marketing Monitor
App ID: (在飞书控制台获取)
App Secret: (在飞书控制台获取)
```

#### 2. 权限配置

申请以下权限：
- `contact:user.base:readonly` - 获取用户基本信息

#### 3. 安全设置 - 重定向URL

**根据实际部署方式选择：**

**方案A - 使用端口3001（推荐用于测试）:**
```
http://101.200.222.139:3001/api/auth/callback
```

**方案B - 使用子路径（生产环境推荐）:**
```
http://101.200.222.139/marketing/api/auth/callback
```

**方案C - 使用独立域名（最佳）:**
```
https://marketing.yourdomain.com/api/auth/callback
```

#### 4. 环境变量配置

在服务器上创建 `.env.local` 文件：

```bash
# SSH 到服务器
ssh root@101.200.222.139

# 进入项目目录（部署后）
cd /opt/embodied-marketing/bilibili-monitor

# 创建环境变量文件
cat > .env.local << 'EOF'
# 飞书开放平台配置
FEISHU_APPID=你的AppID
FEISHU_APP_SECRET=你的AppSecret

# 应用基础URL（必须与飞书回调URL一致）
NEXT_PUBLIC_BASE_URL=http://101.200.222.139:3001

# Node.js 环境
NODE_ENV=production
EOF

# 设置权限
chmod 600 .env.local
```

---

## 部署方式

### 方式一：GitHub Actions 自动部署（推荐）

#### 前置条件

1. **生成SSH密钥对**

```bash
# 在本地Mac执行
ssh-keygen -t ed25519 -f ~/.ssh/embodied-deploy -C "github-actions-deploy"

# 查看公钥（需要添加到服务器）
cat ~/.ssh/embodied-deploy.pub

# 查看私钥（需要添加到GitHub Secrets）
cat ~/.ssh/embodied-deploy
```

2. **将公钥添加到服务器**

```bash
# 复制公钥内容后，SSH到服务器
ssh root@101.200.222.139

# 添加到authorized_keys
echo "你的公钥内容" >> ~/.ssh/authorized_keys

# 测试免密登录（从本地执行）
ssh -i ~/.ssh/embodied-deploy root@101.200.222.139 "echo '连接成功'"
```

3. **配置 GitHub Secrets**

进入仓库页面：https://github.com/aramisjiang-wq/embodied-marketing/settings/secrets/actions

添加以下 Repository secrets：

| Secret 名称 | 值 | 获取方式 |
|-------------|-----|---------|
| `SERVER_HOST` | `101.200.222.139` | 固定值 |
| `SERVER_USER` | `root` | 固定值 |
| `SSH_PRIVATE_KEY` | *(私钥完整内容)* | `cat ~/.ssh/embodied-deploy` |

添加 Variables（可选）：

| Variable 名称 | 默认值 | 说明 |
|---------------|--------|------|
| `PROJECT_NAME` | `embodied-marketing` | 项目名 |
| `PORT` | `3001` | 服务端口 |

#### 触发部署

- **自动触发**: 推送代码到 `main` 分支
- **手动触发**: 
  1. 进入 Actions 页面
  2. 选择 "Deploy to Server" 工作流
  3. 点击 "Run workflow"

---

### 方式二：手动部署（快速上手）

#### Step 1: 克隆代码到服务器

```bash
# SSH 登录
ssh root@101.200.222.139

# 创建目录
mkdir -p /opt/embodied-marketing
cd /opt/embodied-marketing

# 克隆代码
git clone https://github.com/aramisjiang-wq/embodied-marketing.git temp
mv temp/bilibili-monitor/* .
mv temp/bilibili-monitor/.* . 2>/dev/null || true
rm -rf temp

# 查看文件
ls -la
```

#### Step 2: 安装依赖并构建

```bash
cd /opt/embodied-marketing

# 安装Node.js依赖
npm install --production=false

# 构建Next.js应用
npm run build

# 配置Python环境（可选，用于数据采集）
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r scripts/requirements.txt 2>/dev/null || true
deactivate
```

#### Step 3: 配置环境变量

```bash
cp .env.example .env.local
nano .env.local  # 编辑填入实际值
```

#### Step 4: 启动服务

**使用 PM2（推荐）:**

```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start npm --name "embodied-marketing" -- start -- -p 3001

# 设置开机自启
pm2 startup
pm2 save
```

**或使用 Systemd:**

```bash
# 创建service文件
cat > /etc/systemd/system/embodied-marketing.service << 'EOF'
[Unit]
Description=Embodied Marketing Next.js Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/embodied-marketing
ExecStart=/usr/bin/npm run start -- -p 3001
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动
systemctl daemon-reload
systemctl enable embodied-marketing
systemctl start embodied-marketing
```

#### Step 5: 配置 Nginx 反向代理（可选但推荐）

```bash
# 创建配置文件
cat > /etc/nginx/sites-available/embodied-marketing << 'EOF'
server {
    listen 3001;
    server_name 101.200.222.139;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 飞书回调超时设置
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/embodied-marketing /etc/nginx/sites-enabled/

# 测试并重载
nginx -t && systemctl reload nginx
```

**或者使用子路径方案（不影响现有服务）:**

```bash
# 编辑现有的Nginx配置
nano /etc/nginx/sites-available/default

# 在 server {} 块内添加:
location /marketing/ {
    proxy_pass http://127.0.0.1:3001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 重载Nginx
nginx -t && systemctl reload nginx
```

---

## 日常运维

### 服务管理命令

#### Docker 容器（当前运行的旧服务）

```bash
# 查看状态
docker ps | grep embodied

# 查看日志
docker logs -f embodied-map-pro

# 重启服务
docker restart embodied-map-pro

# 进入容器
docker exec -it embodied-map-pro sh
```

#### Systemd 服务（新部署后）

```bash
# 查看状态
systemctl status embodied-marketing

# 启动/停止/重启
systemctl start embodied-marketing
systemctl stop embodied-marketing
systemctl restart embodied-marketing

# 查看日志
journalctl -u embodied-marketing -f

# 开机自启
systemctl enable embodied-marketing
```

#### PM2 管理（如果使用PM2）

```bash
# 查看进程列表
pm2 list

# 查看日志
pm2 logs embodied-marketing

# 重启
pm2 restart embodied-marketing

# 监控面板
pm2 monit
```

### 数据库管理

```bash
# 备份数据库
cp /opt/embodied-marketing/bilibili_monitor.db /backup/bilibili_$(date +%F).db

# 查看数据（进入SQLite）
sqlite3 /opt/embodied-marketing/bilibili_monitor.db

# 常用SQL查询
SELECT * FROM users;
SELECT * FROM brands;
SELECT COUNT(*) FROM videos;

# 退出
.quit
```

### 数据采集任务

```bash
# 手动触发一次采集
curl -X POST http://101.200.222.139:3001/api/collect

# 查看采集状态
curl http://101.200.222.139:3001/api/collect-status

# 查看采集历史
curl http://101.200.222.139:3001/api/collect-history
```

### 日志查看

```bash
# 应用日志
tail -f /opt/embodied-marketing/logs/server.log

# Nginx访问日志
tail -f /var/log/nginx/access.log

# Nginx错误日志
tail -f /var/log/nginx/error.log

# 系统日志
journalctl -f
```

---

## 安全加固

### 🔴 紧急（立即执行）

#### 1. 更改root密码

```bash
passwd root
# 输入强密码（建议12位以上，包含大小写字母+数字+特殊字符）
```

#### 2. 启用防火墙

```bash
# 安装UFW（如果没有）
apt update && apt install ufw -y

# 配置规则
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh          # 22端口
ufw allow 80/tcp       # HTTP
ufw allow 443/tcp      # HTTPS
ufw allow 3001/tcp     # Embodied Marketing（如果使用）
ufw enable

# 查看状态
ufw status verbose
```

#### 3. 清理恶意痕迹（已检测到挖矿木马）

```bash
# 删除可疑文件
rm -f /tmp/nodes /tmp/1.json /tmp/python3

# 检查异常进程
ps aux | grep -E "(nodes|miner|xmr)" | grep -v grep

# 检查定时任务
crontab -l
cat /etc/crontab
ls -la /etc/cron.d/

# 检查异常网络连接
netstat -tulpn | grep ESTAB
```

### 🟡 高优先级（本周内）

#### 4. SSH安全加固

```bash
# 编辑SSH配置
nano /etc/ssh/sshd_config

# 修改以下配置：
PermitRootLogin yes              # 暂时保留（后续改为密钥认证）
PasswordAuthentication yes       # 后续改为 no
MaxAuthTries 3
LoginGraceTime 30
PubkeyAuthentication yes

# 重启SSH服务
systemctl restart sshd
```

#### 5. 配置SSH密钥认证

```bash
# 本地生成密钥（如果还没有）
ssh-keygen -t ed25519 -f ~/.ssh/server-root -C "your-email@example.com"

# 复制公钥到服务器
ssh-copy-id -i ~/.ssh/server-root.pub root@101.200.222.139

# 测试免密登录
ssh -i ~/.ssh/server-root root@101.200.222.139

# 测试成功后，禁用密码登录
# 在服务器编辑 /etc/ssh/sshd_config
# PasswordAuthentication no
# systemctl restart sshd
```

### 🟢 中优先级（本月内）

#### 6. 自动更新和安全补丁

```bash
# 设置自动安全更新
apt install unattended-upgrades -y
dpkg-reconfigure unattended-upgrades

# 或手动定期更新
apt update && apt upgrade -y
```

#### 7. Fail2Ban防暴力破解

```bash
apt install fail2ban -y

# 配置SSH保护
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
findtime = 600
bantime = 3600
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

#### 8. Docker安全加固

```bash
# 为容器添加资源限制
docker update \
  --memory="1g" \
  --memory-swap="1g" \
  --cpus="1.5" \
  --pids-limit=100 \
  --restart unless-stopped \
  embodied-map-pro

# 使用非root用户运行容器（重建时考虑）
```

### 🔵 低优先级（下季度）

#### 9. HTTPS证书

```bash
# 安装Certbot
apt install certbot python3-certbot-nginx -y

# 获取证书（需要有域名）
certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期
certbot renew --dry-run
```

#### 10. 定期备份策略

```bash
# 创建备份脚本
cat > /opt/scripts/backup-embodied.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/embodied"
DATE=$(date +%F)
mkdir -p ${BACKUP_DIR}

# 备份数据库
cp /opt/embodied-marketing/bilibili_monitor.db ${BACKUP_DIR}/db_${DATE}.db

# 备份配置文件
tar czf ${BACKUP_DIR}/config_${DATE}.tar.gz \
  /opt/embodied-marketing/.env.local \
  /etc/nginx/sites-available/embodied-marketing

# 保留最近30天备份
find ${BACKUP_DIR} -mtime +30 -delete

echo "Backup completed: ${DATE}"
EOF

chmod +x /opt/scripts/backup-embodied.sh

# 添加定时任务（每天凌晨3点）
crontab -e
# 添加: 0 3 * * * /opt/scripts/backup-embodied.sh >> /var/log/backup.log 2>&1
```

---

## 故障排查

### 常见问题

#### Q1: 无法访问 http://101.200.222.139:3001

**检查清单：**

```bash
# 1. 确认服务是否启动
netstat -tlnp | grep 3001

# 2. 如果没有监听，检查服务状态
systemctl status embodied-marketing
# 或
pm2 list

# 3. 查看日志找错误
journalctl -u embodied-marketing -n 50 --no-pager

# 4. 检查防火墙
ufw status

# 5. 从本机测试
curl -I http://127.0.0.1:3001
```

**常见原因及解决方案：**
- 服务未启动 → `systemctl start embodied-marketing`
- 端口被占用 → `lsof -i :3001` 找出占用进程
- 防火墙阻止 → `ufw allow 3001/tcp`

---

#### Q2: 飞书登录失败 / 回调报错

**检查步骤：**

```bash
# 1. 确认环境变量是否正确
cat /opt/embodied-marketing/.env.local | grep FEISHU

# 2. 测试回调接口
curl -I http://101.200.222.139:3001/api/auth/callback

# 3. 查看应用日志
journalctl -u embodied-marketing -f | grep -i feishu

# 4. 确认飞书控制台的回调URL完全匹配（包括协议、域名、路径）
```

**常见错误码：**
- `redirect_uri_mismatch` → 飞书控制台的回调URL与代码不一致
- `invalid_code` → code参数过期或已被使用
- `network_error` → 服务器无法访问飞书API（检查网络）

---

#### Q3: 数据采集不工作

**诊断步骤：**

```bash
# 1. 手动触发采集并观察输出
curl -X POST http://101.200.222.139:3001/api/collect

# 2. 检查Python环境
cd /opt/embodied-marketing
source venv/bin/activate
python scripts/collect.py --test

# 3. 查看定时任务状态
systemctl list-timers | grep bilibili

# 4. 查看采集日志
tail -100 /opt/embodied-marketing/logs/collect.log
```

---

#### Q4: 页面显示500错误

**排查流程：**

```bash
# 1. 查看Next.js错误日志
tail -100 /opt/embodied-marketing/.next/server.log

# 2. 检查数据库文件权限
ls -lh /opt/embodied-marketing/*.db

# 3. 检查磁盘空间
df -h

# 4. 检查内存使用
free -h
```

---

#### Q5: Nginx 502 Bad Gateway

**原因：后端服务未运行或端口不对**

```bash
# 检查后端是否正常
curl -I http://127.0.0.1:3001

# 如果失败，重启后端服务
systemctl restart embodied-marketing

# 检查Nginx配置
nginx -t

# 重载Nginx
systemctl reload nginx
```

---

### 性能优化建议

#### 1. Node.js 内存优化

```bash
# 编辑Systemd service文件，添加：
Environment=NODE_OPTIONS="--max-old-space-size=512"
```

#### 2. 启用Gzip压缩

在 `next.config.ts` 中添加：
```typescript
const nextConfig: NextConfig = {
  compress: true,
};
```

#### 3. 数据库索引优化

```sql
-- 在SQLite中创建索引（通过应用迁移或手动）
CREATE INDEX idx_videos_brand_id ON videos(brand_id);
CREATE INDEX idx_videos_published ON videos(published_at);
```

---

## 监控和告警

### 内置监控面板

服务器已有 Glances 监控系统：
```
http://101.200.222.139:61208
```

### 推荐监控指标

| 指标 | 告警阈值 | 检查命令 |
|------|---------|---------|
| CPU使用率 | > 80% 持续5分钟 | `top -bn1 \| grep Cpu` |
| 内存使用率 | > 85% | `free -m` |
| 磁盘使用率 | > 80% | `df -h` |
| 端口响应时间 | > 3秒 | `curl -o /dev/null -s -w '%{time_total}' URL` |
| 进程存活 | 进程不存在 | `pgrep -f "next start"` |

### 日志集中管理（可选）

```bash
# 安装filebeat转发日志到ELK/Loki
# 或简单方案：每日归档
cat > /etc/logrotate.d/embodied-marketing << 'EOF'
/opt/embodied-marketing/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    postrotate
        systemctl reload embodied-marketing > /dev/null 2>&1 || true
    endscript
}
EOF
```

---

## 联系和支持

### 相关链接

| 资源 | 地址 |
|------|------|
| **GitHub仓库** | https://github.com/aramisjiang-wq/embodied-marketing |
| **飞书开放平台** | https://open.feishu.cn/app |
| **Next.js文档** | https://nextjs.org/docs |
| **阿里云控制台** | https://ecs.console.aliyun.com |

### 服务器信息速查

| 项目 | 值 |
|------|-----|
| **IP地址** | 101.200.222.139 |
| **SSH端口** | 22 |
| **用户名** | root |
| **密码** | XLj4kUnh (**⚠️ 请尽快更改**) |
| **操作系统** | Ubuntu (阿里云ECS) |
| **当前Web端口** | 3000 (旧), 3001 (新-待部署) |
| **监控面板** | http://101.200.222.139:61208 |

### 快速命令参考卡

```bash
# SSH登录
ssh root@101.200.222.139

# 查看所有Docker容器
docker ps -a

# 查看系统资源
glances  # 或 htop, top

# 查看磁盘空间
df -h

# 查看内存
free -h

# 重启网络
systemctl restart networking

# 查看端口占用
netstat -tlnp
# 或
ss -tlnp
```

---

## 变更历史

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2026-05-09 | v1.0.0 | 初始版本，包含完整的部署配置和运维指南 | AI Assistant |

---

## 附录

### A. 目录结构说明

```
bilibili-monitor/
├── src/
│   ├── app/                 # Next.js App Router 页面
│   │   ├── api/            # API路由
│   │   ├── (dashboard)/    # 仪表盘页面
│   │   └── login/          # 登录页
│   ├── components/         # React组件
│   └── lib/                # 工具库
│       ├── auth.ts         # 飞书认证逻辑
│       ├── db.ts           # 数据库操作
│       └── user-db.ts      # 用户管理
├── scripts/
│   ├── collect.py          # B站数据采集主程序
│   ├── deploy-to-server.sh # Linux部署脚本
│   └── server-deploy.sh    # 服务器端部署脚本
├── docs/                   # 项目文档
├── deploy/                 # 部署相关配置
│   └── nginx.conf          # Nginx配置示例
├── public/                 # 静态资源
├── .env.example            # 环境变量模板
├── package.json            # Node.js依赖
├── next.config.ts          # Next.js配置
└── middleware.ts            # 中间件（认证拦截）
```

### B. 端口规划表

| 端口 | 服务 | 用途 | 状态 |
|------|------|------|------|
| 22 | SSH | 远程管理 | ✅ 开放 |
| 80 | HTTP/Nginx | Web访问（旧项目） | ✅ 开放 |
| 443 | HTTPS/Nginx | SSL加密访问 | ⏳ 待配置 |
| 3000 | Next.js (Docker) | 旧项目 Embodied Map | ✅ 运行中 |
| 3001 | Next.js (新) | **新项目 Embodied Marketing** | 🔲 待部署 |
| 61208 | Glances | 系统监控 | ✅ 运行中 |
| 8081 | feishu2md | 飞书文档转换 | ✅ 运行中 |
| 8082 | monitor.py | Python监控 | ✅ 运行中 |

### C. 文件权限参考

```bash
# 项目目录权限
chmod 755 /opt/embodied-marketing
chown -R root:root /opt/embodied-marketing

# 环境变量文件（敏感）
chmod 600 /opt/embodied-marketing/.env.local

# 日志目录（可写）
chmod 775 /opt/embodied-marketing/logs

# 数据库文件
chmod 640 /opt/embodied-marketing/*.db
```

---

**📌 提示**: 建议将此文档保存到本地或打印备用。如有疑问，查阅对应章节或联系维护者。
