# 飞书登录修复 - 紧急部署指南

## 问题根因

**错误信息**: `[Feishu Login] QR container not found`

**根本原因**: 
- 旧代码使用飞书 **QRLogin SDK** 渲染二维码
- 存在时序竞态条件：SDK 加载完成时 DOM 元素尚未挂载
- 复杂的条件渲染逻辑导致 `qrContainerRef.current` 为 null

## 解决方案

✅ 已将登录页面从 **二维码扫码** 改为 **直接重定向** 方式：
- 移除所有 QRLogin SDK 依赖
- 简化为：获取授权 URL → 显示按钮 → 用户点击跳转
- 消除时序问题和 DOM 引用问题

## 部署步骤

### 方法 1: 使用部署脚本（推荐）

```bash
cd "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor"
chmod +x scripts/deploy-login-fix.sh
./scripts/deploy-login-fix.sh
```

### 方法 2: 手动执行

#### Step 1: 同步代码到服务器
```bash
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/" \
    root@101.200.222.139:/root/embodied-marketing/bilibili-monitor/
```

#### Step 2: SSH 登录服务器并重建
```bash
ssh root@101.200.222.139

# 进入项目目录
cd /root/embodied-marketing/bilibili-monitor

# 停止服务
pm2 stop embodied-marketing
pm2 delete embodied-marketing

# 清理旧构建
rm -rf .next

# 重新构建
npm run build

# 启动服务
pm2 start npm --name "embodied-marketing" -- start -p 8082
pm2 save

# 查看状态
pm2 status
pm2 logs embodied-marketing --lines 50
```

### Step 3: 验证修复

1. 打开浏览器访问: http://101.200.222.139:8082/login
2. 应该看到 **蓝色按钮** "使用飞书账号登录"（不是二维码）
3. 点击按钮跳转到飞书授权页面
4. 授权后自动回调到应用

## 关键文件变更

### src/app/login/page.tsx
- ❌ 移除: QRLogin SDK 加载逻辑
- ❌ 移除: qrContainerRef 引用
- ❌ 移除: renderQRCode() 函数
- ✅ 新增: 直接显示授权 URL 按钮
- ✅ 简化: 三状态逻辑 (loading/error/success)

## 预期结果

- ✅ 不再出现 "QR container not found" 错误
- ✅ 页面加载后立即显示登录按钮
- ✅ 点击按钮正常跳转到飞书授权
- ✅ 授权流程完整可用

## 回滚方案

如果新版本有问题，可以回滚到之前的版本：

```bash
cd /root/embodied-marketing/bilibili-monitor
git checkout HEAD~1 -- src/app/login/page.tsx
npm run build
pm2 restart embodied-marketing
```

## 故障排查

### 如果仍然看到旧页面：
```bash
# 清除浏览器缓存或使用隐私模式
# 或者在服务器上检查构建产物
ls -la .next/server/app/login/
cat .next/server/app/login/page.js | grep "Direct redirect flow"
```

### 如果构建失败：
```bash
# 检查 Node.js 版本
node --version  # 需要 >= 18.17

# 清理并重装依赖
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 如果服务启动失败：
```bash
# 查看详细日志
pm2 logs embodied-marketing --err --lines 100

# 检查端口占用
lsof -i :8082
netstat -tlnp | grep 8082
```

## 技术细节

### 为什么移除 QRLogin SDK？

1. **时序竞态**: SDK 异步加载 + React 严格模式双重渲染 = ref 为 null
2. **外部依赖**: 需要从 feishucdn.com 加载脚本，增加失败点
3. **复杂度高**: 多层嵌套条件渲染，难以维护
4. **用户体验差**: 二维码加载慢、容易超时

### 新方案优势

1. **简单可靠**: 纯前端 fetch + 重定向，无外部依赖
2. **即时响应**: API 返回后立即显示按钮
3. **兼容性好**: 无需特殊 SDK，所有浏览器支持
4. **易于调试**: 日志清晰，问题易定位

## 联系支持

如有问题，请提供以下信息：
1. 浏览器控制台截图 (F12 → Console)
2. PM2 日志: `pm2 logs embodied-marketing --lines 100`
3. 网络请求详情 (F12 → Network → feishu API)

---

**更新时间**: 2026-05-10  
**版本**: v2.0 (Direct Redirect)  
**状态**: ✅ Ready for Deployment
