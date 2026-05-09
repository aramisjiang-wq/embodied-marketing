# 🚀 B站竞品监控系统 v2.31.0 生产部署指南

> **版本**: v2.31.0-security  
> **日期**: 2026-05-09  
> **状态**: ✅ 代码已就绪，等待网络恢复后部署

---

## 📌 部署前检查清单

### **1. 环境准备**

- [ ] 确保可以 SSH 连接到服务器: `ssh root@120.76.204.224`
- [ ] 服务器已安装 Node.js 18+ 和 npm
- [ ] 服务器有足够的磁盘空间 (建议 > 1GB)
- [ ] 已配置好飞书应用凭证 (FEISHU_APPID, FEISHU_APP_SECRET)
- [ ] 飞书开发者后台已添加回调地址:
  - 开发环境: `http://localhost:3000/api/auth/callback`
  - 生产环境: `https://你的域名.com/api/auth/callback`

### **2. 本地代码确认**

```bash
cd bilibili-monitor

# 检查最新 commit
git log -1 --oneline
# 应该显示: 05f2de9 🔐 Fix API RBAC + Update docs (v2.31.0-security)

# 检查关键文件
ls -la src/lib/auth.ts src/lib/user-db.ts middleware.ts src/app/login/
# 所有文件都应该存在

# 检查数据库
sqlite3 bilibili_monitor.db ".tables"
# 应该显示12张表（包括 users, login_logs, action_logs）
```

### **3. 数据库备份（重要！）**

**在本地执行：**
```bash
# 备份本地数据库
cp bilibili_monitor.db bilibili_monitor.db.backup_$(date +%Y%m%d)

# 验证数据完整性
sqlite3 bilibili_monitor.db "
  SELECT 'brands: ' || COUNT(*) FROM brands;
  SELECT 'videos: ' || COUNT(*) FROM videos;
  SELECT 'video_stats: ' || COUNT(*) FROM video_stats;
"
```

**预期输出：**
```
brands: 13
videos: 527
video_stats: 527
```

---

## 🔧 方案A：自动部署脚本（推荐）

### **使用方法**

```bash
cd bilibili-monitor

# 赋予执行权限（如果还没做）
chmod +x scripts/deploy-production.sh

# 1️⃣ 先预览模式（不实际执行）
./scripts/deploy-production.sh --dry-run

# 2️⃣ 确认无误后，实际部署
./scripts/deploy-production.sh

# 可选参数：
# --skip-db    : 仅更新代码，不同步数据库（如果服务器数据较新）
# --force      : 强制覆盖服务器数据库（⚠️ 会丢失服务器数据！）
```

### **脚本功能特性**

| 特性 | 说明 |
|-----|------|
| ✅ 自动SSH连接测试 | 部署前验证网络可达 |
| ✅ 服务器数据备份 | 自动备份数据库和代码到 /opt/bilibili-monitor/backups/ |
| ✅ 增量代码同步 | 使用 rsync 增量同步，只传输变更的文件 |
| ✅ 安全的数据库合并 | 使用 SQLite ATTACH 合并数据，避免丢失 |
| ✅ 自动安装依赖 | 检测并安装 npm 依赖 |
| ✅ 项目构建 | 执行 next build 构建生产版本 |
| ✅ 服务重启 | 支持 PM2/Systemd/手动重启 |
| ✅ 健康检查 | 验证端口、进程、数据库状态 |
| ✅ 回滚支持 | 备份文件可快速恢复 |
| ✅ 详细日志 | 完整的操作日志记录到 deploy_xxx.log |

### **部署后验证**

```bash
# 1. 访问系统
open http://120.76.204.224:3000/login

# 2. 应该看到飞书登录页（不是原来的首页）

# 3. 扫码登录测试

# 4. 检查管理员后台
open http://120.76.204.224:3000/admin

# 5. 测试权限控制
# 用 viewer 账号尝试 POST /api/brands → 应返回 403
# 用 editor/admin 账号尝试相同操作 → 应成功
```

---

## 🔧 方案B：手动分步部署（如果脚本失败）

### **步骤1：登录服务器**
```bash
ssh root@120.76.204.224
```

### **步骤2：备份现有数据**
```bash
cd /opt/bilibili-monitor

# 创建备份目录
mkdir -p backups

# 备份数据库
cp bilibili_monitor.db backups/bilibili_monitor.db.$(date +%Y%m%d_%H%M%S).bak

# 备份代码（可选）
tar -czf backups/code.$(date +%Y%m%d_%H%M%S).tar.gz \
  src/ package.json next.config.ts middleware.ts *.db
```

### **步骤3：从 GitHub 拉取最新代码**
```bash
# 方法1：如果服务器有 Git
cd /opt/bilibili-monitor
git pull origin main

# 方法2：如果没有 Git，手动下载
cd /tmp
git clone https://github.com/aramisjiang-wq/embodied-marketing.git temp-deploy
cp -r temp-deploy/bilibili-monitor/* /opt/bilibili-monitor/
rm -rf temp-deploy
```

### **步骤4：同步数据库**
```bash
cd /opt/bilibili-monitor

# 上传本地数据库（在本地机器执行）
scp ~/Downloads/Codebase/LimX\ Code/Embodied\ Marketing/bilibili-monitor/bilibili_monitor.db \
    root@120.76.204.224:/opt/bilibili-monitor/bilibili_monitor.db.new

# 在服务器上合并数据库
sqlite3 bilibili_monitor.db <<SQL
ATTACH DATABASE 'bilibili_monitor.db.local' AS local_db;

-- 合并所有业务数据
INSERT OR IGNORE INTO brands SELECT * FROM local_db.brands;
INSERT OR IGNORE INTO videos SELECT * FROM local_db.videos;
INSERT OR IGNORE INTO video_stats SELECT * FROM local_db.video_stats;
INSERT OR IGNORE INTO brand_stats SELECT * FROM local_db.brand_stats;
INSERT OR IGNORE INTO site_likes SELECT * FROM local_db.site_likes;
INSERT OR IGNORE INTO site_views SELECT * FROM local_db.site_views;

DETACH DATABASE local_db;
SQL

# 清理临时文件
rm -f bilibili_monitor.db.local

# 设置权限
chown bilibili-user:bilibili-user bilibili_monitor.db
chmod 640 bilibili_monitor.db
```

### **步骤5：安装依赖和构建**
```bash
cd /opt/bilibili-monitor

# 安装依赖
npm install --production

# 构建
npm run build
# 或
npx next build
```

### **步骤6：启动服务**
```bash
# 使用 PM2（推荐）
pm2 delete bilibili-monitor 2>/dev/null || true
pm2 start npm --name "bilibili-monitor" -- start
pm2 save

# 或使用 Systemd
systemctl restart bilibili-monitor

# 或手动启动（开发测试用）
nohup npx next start -p 3000 > logs/server.log 2>&1 &
```

### **步骤7：验证部署成功**
```bash
# 检查端口
ss -tlnp | grep :3000

# 检查进程
pm2 list | grep bilibili

# 检查日志
tail -50 logs/server.log | grep -i error

# 测试API
curl http://localhost:3000/api/overview
# 应返回 JSON 数据（可能需要先登录）

# 检查数据库
sqlite3 bilibili_monitor.db ".tables"
# 应显示12张表
```

---

## 🔄 回滚方案（如果部署失败）

### **场景1：代码有问题**
```bash
# 恢复到备份的代码
cd /opt/bilibili-monitor/backups
tar -xzf code.YYYYMMDD_HHMMSS.tar.gz -C /opt/bilibili-monitor/

# 重启服务
pm2 restart bilibili-monitor
```

### **场景2：数据库损坏**
```bash
# 恢复到备份数据库
cd /opt/bilibili-monitor/backups
cp bilibili_monitor.db.YYYYMMDD_HHMMSS.bak /opt/bilibili-monitor/bilibili_monitor.db

# 重启服务
pm2 restart bilibili-monitor
```

### **场景3：完全回滚到部署前**
```bash
# 停止服务
pm2 stop bilibili-monitor

# 删除新代码
rm -rf /opt/bilibili-monitor/src /opt/bilibili-monitor/.next

# 从备份恢复
tar -xzf /opt/bilibili-monitor/backups/code.YYYYMMDD_HHMMSS.tar.gz -C /opt/bilibili-monitor/

# 重启
pm2 restart bilibili-monitor
```

---

## ⚠️ 常见问题排查

### **Q1: SSH 连接超时**
```
原因: 服务器防火墙、VPN未连接、服务器关机
解决: 
  1. 检查 VPN 是否开启
  2. 联系运维确认服务器状态
  3. 尝试 ping/traceroute 诊断网络
```

### **Q2: 数据库合并失败**
```
错误: "database is locked" 或 "disk I/O error"
解决:
  1. 确保没有其他进程在使用数据库（停止 Next.js 服务）
  2. 检查磁盘空间: df -h
  3. 使用 .db.new 中间文件方式避免锁定
```

### **Q3: 服务启动失败**
```
错误: "Port 3000 already in use" 或 "EADDRINUSE"
解决:
  1. 查找占用端口的进程: lsof -i :3000
  2. 杀死进程: kill <PID>
  3. 重启服务
```

### **Q4: 飞书登录失败**
```
错误: "redirect_uri_mismatch" 或 "invalid client"
解决:
  1. 检查 .env.local 中的 NEXT_PUBLIC_BASE_URL 是否正确
  2. 确认飞书开发者后台的重定向地址与代码一致
  3. 检查是否申请了 contact:user.base:readonly 权限
```

### **Q5: 权限控制不生效**
```
现象: viewer 角色仍能修改品牌
原因: 可能使用了旧的浏览器 Session
解决:
  1. 清除浏览器 Cookie（或使用无痕模式）
  2. 重新登录
  3. 检查浏览器开发者工具中的 Cookie 值是否包含新的 session
```

---

## 📊 部署成功标准

完成以下所有检查项才算部署成功：

### **功能性验证**
- [ ] 登录页正常显示（`/login` 显示二维码）
- [ ] 飞书扫码能正常跳转
- [ ] Dashboard 正常加载数据
- [ ] 能查看品牌列表、视频列表
- [ ] 对比页面功能正常

### **安全性验证**
- [ ] 未登录访问 `/` 自动跳转到 `/login`
- [ ] 登录后能看到用户头像和名字
- [ ] `/admin` 页面仅 admin 可见
- [ ] viewer 角色 POST `/api/brands` 返回 403
- [ ] editor/admin 角色 POST `/api/brands` 返回 201

### **数据完整性验证**
- [ ] 数据库包含 13 个品牌
- [ ] 数据库包含 527+ 个视频
- [ ] users 表存在（可能为空或只有管理员账号）
- [ ] 无数据库错误日志

### **性能验证**
- [ ] 首次加载 < 3秒
- [ ] API 响应时间 < 500ms
- [ ] 内存占用 < 512MB
- [ ] CPU 占用 < 30%

---

## 🆘 技术支持

如果遇到问题：

1. **查看部署日志**: `cat deploy_YYYYMMDD_HHMMSS.log`
2. **查看服务日志**: `pm2 logs bilibili-monitor --lines 100`
3. **查看系统日志**: `journalctl -u bilibili-monitor -f` (Systemd)
4. **数据库调试**: `sqlite3 bilibili_monitor.db "SELECT ..."`

---

**祝部署顺利！🚀**
