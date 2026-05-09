# 🚀 Embodied Marketing - 运维配置清单

> **服务器**: 101.200.222.139 (阿里云ECS)
> **部署时间**: 2026-05-09
> **方案**: 端口直连模式 (8082)
>

---

## ✅ 已完成的配置（服务端）

| 项目 | 值 | 状态 |
|------|-----|------|
| **项目目录** | `/opt/embodied-marketing` | ✅ 已部署 |
| **运行端口** | `:8082` | ✅ PM2 运行中 |
| **进程管理** | PM2 (embodied-marketing) | ✅ online |
| **Node.js** | v20.20.2 LTS | ✅ 正常 |
| **Next.js** | v16.2.4 | ✅ 已构建 |
| **本地测试** | HTTP 307/200 OK | ✅ 通过 |

---

## 🔧 需要运维同事配置的事项

### 任务1：阿里云安全组 - 开放 8082 端口 ⭐⭐⭐ （必须）

**操作路径**:
```
阿里云控制台 → ECS → 实例列表 → 101.200.222.139 
→ 安全组 → 配置规则 → 入方向 → 手动添加
```

**添加规则**:

| 参数 | 值 | 说明 |
|------|-----|------|
| 授权策略 | 允许 | Allow |
| 协议类型 | TCP | HTTP协议 |
| 端口范围 | **8082/8082** | 单端口 |
| 授权对象 | **0.0.0.0/0** | 对所有IP开放（或限制为办公网IP）|
| 描述 | **Embodied-Marketing** | 规则说明 |

**生效时间**: 通常 < 1分钟

**验证命令**（运维可用）:
```bash
# 从外部测试连通性
curl -I http://101.200.222.139:8082
# 预期: HTTP/1.1 307 Temporary Redirect (或 200 OK)
```

---

### 任务2：飞书开放平台 - 配置 OAuth 回调 ⭐⭐⭐ （必须）

**操作路径**:
```
飞书开放平台 → https://open.feishu.cn/app
→ 选择企业自建应用 → 安全设置 → 重定向URL
```

**添加回调地址**:

```
http://101.200.222.139:8082/api/auth/callback
```

**注意事项**:
- ✅ 必须是完整的URL（包含 http:// 和端口号）
- ✅ 不能有多余的空格或换行
- ✅ 保存后可能需要发布应用版本才生效

**应用权限要求**:
- 申请权限: `contact:user.base:readonly` (获取用户基本信息)
- 如果还没有创建应用，需要先创建一个"企业自建应用"

---

### 任务3：（可选）填入飞书凭证到服务器

**如果运维有飞书的 AppID 和 AppSecret**，SSH到服务器执行：

```bash
ssh root@101.200.222.139

# 编辑环境变量文件
nano /opt/embodied-marketing/.env.local
```

修改这两行：
```env
FEISHU_APPID=真实的AppID
FEISHU_APP_SECRET=真实的AppSecret
```

保存后重启：
```bash
pm2 restart embodied-marketing
```

---

## 📋 验证清单（配置完成后逐项检查）

### 基础访问测试

- [ ] **浏览器打开**: http://101.200.222.139:8082
  - 预期: 自动跳转到登录页 (`/login`)
  
- [ ] **登录页正常显示**: http://101.200.222.139:8082/login
  - 预期: 看到"飞书登录"按钮
  
- [ ] **点击"厂家对比"**: 应该跳转到正确路径
  - 预期: `/login?redirect=/compare` ✅
  - ❌ 不应该跳转到: `/login?redirect=%2Fcompare` (旧问题)

### 飞书登录流程测试

- [ ] **点击"飞书登录"**
  - 预期: 跳转到飞书授权页面
  
- [ ] **扫码/账号授权后**
  - 预期: 回调到 `http://101.200.222.139:8082/api/auth/callback`
  - 然后自动跳转回仪表板首页
  
- [ ] **仪表板数据显示**
  - 预期: 能看到侧边栏 + 主内容区域（即使没有数据也不应该是空白）

### API 功能测试

运维可以用 curl 快速验证：

```bash
# 测试系统状态API
curl http://101.200.222.139:8082/api/system-status
# 预期返回JSON: {"success":true,"data":{"status":"idle",...}}

# 测试采集状态API
curl http://101.200.222.139:8082/api/collect-status
# 预期返回JSON数据
```

---

## 🔍 故障排查速查

### 问题1：打不开 http://101.200.222.139:8082

**检查顺序**:
1. 安全组是否已放行 8082？（最常见原因）
2. 用 `telnet 101.200.222.139 8082` 测试TCP连接
3. SSH 到服务器检查 PM2 状态: `pm2 list`

### 问题2：能打开但页面空白/报错

**浏览器按 F12 打开开发者工具查看**:
- Console 标签页是否有红色错误？
- Network 标签页是否有请求失败（红色）？

**常见错误及解决**:
- `Failed to fetch /api/*` → 检查 middleware.ts 配置
- `404 Not Found` → 检查 .next 构建产物是否完整
- `302 重定向循环` → 检查 cookie 或 session 配置

### 问题3：飞书登录失败

**检查项**:
1. 飞书控制台的回调地址是否完全匹配？
   - 必须是: `http://101.200.222.139:8082/api/auth/callback`
   
2. 服务器环境变量是否已填入？
   ```bash
   ssh root@101.200.222.139 "grep FEISHU /opt/embodied-marketing/.env.local"
   ```

3. 服务器能否访问飞书API？
   ```bash
   ssh root@101.200.222.139 "curl -I https://open.feishu.cn"
   ```

---

## 📊 服务架构图（当前）

```
用户浏览器
    ↓
http://101.200.222.139:8082
    ↓
[阿里云安全组] ← 需要放行 8082/tcp
    ↓
[ECS服务器 :8082]
    ↓
[PM2: embodied-marketing]
    ↓
[Next.js 16.2.4 :8082]
    ↓
✅ 返回页面/API数据
```

---

## 🎯 后续优化（可选，不急）

### 优先级P1（本周内）

- [ ] 配置域名 DNS 解析: `mkt.limxdynamics.com` → `101.200.222.139`
- [ ] 配置 Nginx 域名虚拟主机
- [ ] 申请 HTTPS 证书 (Let's Encrypt)

### 优先级P2（本月内）

- [ ] 配置飞书管理员账号
- [ ] 初始化品牌监控数据
- [ ] 设置定时数据采集任务

### 优先级P3（下季度）

- [ ] 设置监控告警 (Prometheus + Grafana)
- [ ] 配置自动备份策略
- [ ] 性能优化和压测

---

## 📞 联系信息

**服务器信息速查卡**:
```
IP: 101.200.222.139
SSH: root@101.200.222.139
端口: 22 (SSH), 8082 (Web)
项目目录: /opt/embodied-marketing
进程管理: pm2 list | grep embodied
日志查看: pm2 logs embodied-marketing --lines 100
重启服务: pm2 restart embodied-marketing
```

**GitHub仓库**: https://github.com/aramisjiang-wq/embodied-marketing

**文档位置**:
- 本地: bilibili-monitor/docs/DEPLOYMENT-GUIDE.md
- 服务器: /opt/embodied-marketing/docs/

---

## ✅ 完成标志

当以下全部满足时，说明部署成功：

- [ ] 阿里云安全组已放行 8082 端口
- [ ] 飞书控制台已配置回调地址
- [ ] 浏览器可以打开 http://101.200.222.139:8082
- [ ] 页面正常显示（不是空白）
- [ ] 点击功能按钮不会跳错路径
- [ ] 飞书登录流程可走通（如果有凭证）

---

**祝部署顺利！如有问题随时联系！** 🚀
