# 🌐 多产品共存部署方案 - 101.200.222.139

> **目标**: 在同一台服务器上同时运行 3 个产品，通过不同端口和域名区分
>
> **最后更新**: 2026-05-09

---

## 📋 产品清单与端口规划

| 产品 | 用途 | 端口 | 域名（建议） | 当前状态 |
|------|------|------|-------------|---------|
| **Feishu2MD** | 飞书文档转换工具 | `:8081` | feishu2md.yourdomain.com | ✅ 运行中 |
| **Embodied Map** | 地图/可视化产品（旧） | `:3000` | map.yourdomain.com 或 IP直访 | ✅ 运行中 (Docker) |
| **Embodied Marketing** | B站竞品监控系统（新） | `:3001` | marketing.yourdomain.com | 🔲 **待部署** |

---

## 🏗️ 架构设计

### 访问方式对比

#### 方式1：IP + 端口（最简单，无需域名）

```
http://101.200.222.139:8081   → Feishu2MD
http://101.200.222.139:3000   → Embodied Map
http://101.200.222.139:3001   → Embodied Marketing ✨
```

✅ **优点**: 无需配置域名，立即可用  
❌ **缺点**: 需要记住端口号，不专业

---

#### 方式2：独立域名（推荐生产环境）⭐

```
http://feishu2md.example.com     → :8081
http://map.example.com          → :3000
http://marketing.example.com    → :3001
```

✅ **优点**: 专业、易记、可配置HTTPS  
❌ **缺点**: 需要3个域名（或使用子域名）

---

#### 方式3：子路径共享域名（节省域名）

```
http://example.com/feishu2md/      → :8081
http://example.com/map/             → :3000
http://example.com/marketing/       → :3001
```

✅ **优点**: 只需1个域名  
⚠️ **注意**: 需要修改Next.js的basePath配置

---

## 🚀 实施步骤（推荐：方式1 + 方式2结合）

### Step 1: 确认当前服务状态

```bash
# SSH到服务器
ssh root@101.200.222.139

# 查看所有监听端口
netstat -tlnp | grep -E "(8081|3000|3001)"

# 查看Docker容器
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"

# 查看Systemd服务
systemctl list-units --type=service --state=running | grep -E "(feishu|embodied)"
```

**预期输出：**
```
tcp  0.0.0.0:8081  ...  feishu2md
tcp  0.0.0.0:3000  ...  embodied-map-pro (Docker)
tcp  0.0.0.0:3001  ...  (空 - 待部署)
```

---

### Step 2: 部署 Embodied Marketing 到端口3001

#### 2.1 克隆代码

```bash
# 创建项目目录
mkdir -p /opt/embodied-marketing
cd /opt/embodied-marketing

# 从GitHub克隆最新代码
git clone https://github.com/aramisjiang-wq/embodied-marketing.git temp_repo
mv temp_repo/bilibili-monitor/* .
mv temp_repo/bilibili-monitor/.gitignore . 2>/dev/null || true
rm -rf temp_repo

# 查看文件
ls -la
```

#### 2.2 安装依赖并构建

```bash
cd /opt/embodied-marketing

# 安装Node.js依赖
npm install --production=false

# 构建Next.js应用（可能需要几分钟）
npm run build

# 如果构建成功，会看到:
# ✓ Generating static pages (0/13)
# ✓ Finalizing page optimization
```

#### 2.3 配置环境变量

```bash
# 复制模板
cp .env.example .env.local

# 编辑配置
nano .env.local
```

**填入以下内容：**
```env
# 飞书开放平台配置（必需）
FEISHU_APPID=你的飞书AppID
FEISHU_APP_SECRET=你的飞书AppSecret

# 应用基础URL（重要！）
NEXT_PUBLIC_BASE_URL=http://101.200.222.139:3001

# Node.js 环境
NODE_ENV=production
```

保存退出（Ctrl+O, Enter, Ctrl+X）

#### 2.4 启动服务（使用PM2）

```bash
# 全局安装PM2（如果没有）
npm install -g pm2

# 启动应用在3001端口
pm2 start npm --name "embodied-marketing" -- start -- -p 3001

# 设置开机自启
pm2 startup
pm2 save

# 验证启动成功
pm2 list
pm2 logs embodied-marketing --lines 20
```

**或者使用 Systemd（更稳定）：**

```bash
# 创建service文件
cat > /etc/systemd/system/embodied-marketing.service << 'EOF'
[Unit]
Description=Embodied Marketing - B站竞品监控
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/embodied-marketing
ExecStart=/usr/bin/npm run start -- -p 3001
Restart=always
RestartSec=10
StandardOutput=append:/opt/embodied-marketing/logs/server.log
StandardError=append:/opt/embodied-marketing/logs/server.log
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动
systemctl daemon-reload
systemctl enable embodied-marketing
systemctl start embodied-marketing

# 查看状态
systemctl status embodied-marketing
journalctl -u embodied-marketing -f
```

---

### Step 3: 配置 Nginx 反向代理（可选但推荐）

#### 3.1 为每个产品创建独立的Nginx配置

**Embodied Marketing 配置：**

```bash
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

        # 飞书OAuth回调超时设置
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/embodied-marketing /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载Nginx
systemctl reload nginx
```

#### 3.2 如果有域名，配置基于域名的路由

**假设你有域名 example.com 和子域名：**

```bash
# Emboded Marketing - 域名访问
cat > /etc/nginx/sites-available/marketing-domain << 'EOF'
server {
    listen 80;
    server_name marketing.example.com www.marketing.example.com;

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

        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }
}
EOF

# 启用
ln -sf /etc/nginx/sites-available/marketing-domain /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

### Step 4: 配置防火墙放行新端口

```bash
# 放行3001端口
ufw allow 3001/tcp comment "Embodied Marketing"

# 查看防火墙状态
ufw status verbose

# 应该能看到:
# 22/tcp                     ALLOW IN    Anywhere
# 80/tcp                     ALLOW IN    Anywhere
# 443/tcp                    ALLOW IN    Anywhere
# 8081/tcp                   ALLOW IN    Feishu2MD
# 3000/tcp                   ALLOW IN    Embodied Map
# 3001/tcp                   ALLOW IN    Embodied Marketing  ← 新增
```

---

### Step 5: 验证所有产品正常运行

```bash
# 本地测试所有端口
curl -I http://127.0.0.1:8081   # Feishu2MD
curl -I http://127.0.0.1:3000   # Embodied Map
curl -I http://127.0.0.1:3001   # Embodied Marketing ✨

# 或从外部浏览器测试
# http://101.200.222.139:8081
# http://101.200.222.139:3000
# http://101.200.222.139:3001  ← 新部署的产品
```

---

## 📊 最终效果验证

### 访问地址汇总表

| 产品 | URL | 预期响应 |
|------|-----|---------|
| **Feishu2MD** | http://101.200.222.139:8081 | ✅ 飞书文档转换界面 |
| **Embodied Map** | http://101.200.222.139:3000 | ✅ 地图/可视化界面 |
| **Embodied Marketing** | http://101.200.222.139:3001 | ✅ B站竞品监控仪表盘 |

### 飞书回调地址配置

**在飞书开放平台为 Emboded Marketing 应用添加重定向URL：**

```
http://101.200.222.139:3001/api/auth/callback
```

> ⚠️ **注意**: 这个URL必须与你 `.env.local` 中的 `NEXT_PUBLIC_BASE_URL` 完全一致！

---

## 🔧 日常运维命令速查

### 启停各产品服务

```bash
# Embodied Marketing (新)
pm2 restart embodied-marketing          # PM2方式
# 或
systemctl restart embodied-marketing    # Systemd方式

# Embodied Map (旧Docker)
docker restart embodied-map-pro

# Feishu2MD
# 根据实际启动方式重启（可能是systemd/docker/pm2）
```

### 查看日志

```bash
# Embodied Marketing
pm2 logs embodied-marketing --lines 100
tail -f /opt/embodied-marketing/logs/server.log

# Embodied Map
docker logs -f embodied-map-pro

# 所有产品的Nginx日志
tail -f /var/log/nginx/access.log | grep -E "(marketing|map|feishu)"
```

### 资源监控

```bash
# 查看所有产品进程占用资源
ps aux | grep -E "(next|feishu)" | grep -v grep

# Docker容器资源
docker stats --no-stream

# 端口占用
netstat -tlnp | grep -E "(8081|3000|3001)"
```

---

## ⚠️ 注意事项

### 1. 端口冲突避免

如果某个端口已被占用：
```bash
# 查找占用进程
lsof -i :3001

# 杀掉占用进程（谨慎操作）
kill -9 <PID>

# 或者更换端口号（修改 .env.local 和启动命令）
```

### 2. 内存管理

3个产品同时运行会增加内存消耗。建议：

```bash
# 查看总内存
free -h

# 如果内存紧张（<1GB可用），考虑：
# - 限制Node.js内存: NODE_OPTIONS="--max-old-space-size=256"
# - 使用swap: fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile
```

### 3. 数据备份策略

每个产品应该有独立的备份计划：

```bash
# 创建统一备份脚本
cat > /opt/scripts/backup-all.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/all-products"
DATE=$(date +%F)
mkdir -p ${BACKUP_DIR}

# 备份 Embodied Marketing 数据库
cp /opt/embodied-marketing/bilibili_monitor.db ${BACKUP_DIR}/marketing_${DATE}.db 2>/dev/null || true

# 备份 Embodied Map 数据（如果在容器外）
docker cp embodied-map-pro:/app/data/db.sqlite ${BACKUP_DIR}/map_${DATE}.sqlite 2>/dev/null || true

# 备份 Feishu2MD 数据（如果有）
cp /opt/feishu2md/data/*.db ${BACKUP_DIR}/feishu2md_${DATE}.db 2>/dev/null || true

echo "All products backup completed: ${DATE}"
EOF

chmod +x /opt/scripts/backup-all.sh

# 添加定时任务（每天凌晨3点）
crontab -e
# 添加: 0 3 * * * /opt/scripts/backup-all.sh >> /var/log/backup-all.log 2>&1
```

---

## 🎯 下一步行动清单

- [ ] **立即执行**: SSH到服务器，按照Step 2部署Embodied Marketing
- [ ] **配置环境变量**: 填入飞书AppID和AppSecret
- [ ] **测试访问**: 浏览器打开 http://101.200.222.139:3001
- [ ] **配置飞书回调**: 在飞书控制台添加回调URL
- [ ] **首次登录测试**: 使用飞书账号登录
- [ ] **创建管理员**: 手动创建或自动授权第一个登录用户为admin
- [ ] **配置防火墙**: 确保3001端口已放行
- [ ] **可选**: 配置域名和HTTPS证书
- [ ] **可选**: 设置自动备份任务

---

## 📞 故障快速排查

### 问题：3001端口无法访问

```bash
# 1. 检查服务是否启动
pm2 list | grep embodied
# 或
systemctl status embodied-marketing

# 2. 检查端口是否监听
netstat -tlnp | grep 3001

# 3. 检查防火墙
ufw status | grep 3001

# 4. 测试本地访问
curl -I http://127.0.0.1:3001

# 5. 查看错误日志
pm2 logs embodied-marketing --err --lines 50
```

### 问题：飞书登录失败

```bash
# 1. 确认环境变量
cat /opt/embodied-marketing/.env.local | grep FEISHU

# 2. 测试回调接口
curl -v http://101.200.222.139:3001/api/auth/callback

# 3. 检查网络连通性（服务器能否访问飞书API）
curl -I https://open.feishu.cn

# 4. 查看应用日志中的错误信息
pm2 logs embodied-marketing | grep -i error
```

---

**📌 提示**: 完整的详细文档请参阅 [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)

---

**维护者备注**: 此方案确保3个产品完全隔离、互不影响，便于独立维护和升级。
