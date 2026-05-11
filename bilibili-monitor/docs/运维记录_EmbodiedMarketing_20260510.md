# 运维记录 - Embodied Marketing

## 框架图谱

```text
Embodied Marketing 运维记录
├── 代码一致性
│   ├── 本地仓库
│   ├── GitHub: aramisjiang-wq/embodied-marketing
│   └── 服务器: 101.200.222.139:8082
├── 登录认证
│   ├── 飞书 OAuth2
│   ├── 回调地址修复
│   └── Session Cookie 修复
├── 数据链路
│   ├── SQLite: bilibili_monitor.db
│   ├── Python 采集脚本
│   ├── Bilibili Cookie 凭证
│   └── Cron 每日采集
├── 权限体系
│   ├── 普通用户: 添加品牌
│   └── 管理员: 删除品牌、用户管理、手动采集
└── 后续维护
    ├── Cookie 定期更新
    ├── 采集日志巡检
    └── B站 412 风控处理
```

## 文档信息

**文档标题**: 运维记录_EmbodiedMarketing_20260510.md  
**产品名称**: Embodied Marketing / LimX Marketing  
**系统地址**: http://101.200.222.139:8082  
**GitHub 仓库**: https://github.com/aramisjiang-wq/embodied-marketing  
**记录日期**: 2026-05-10  
**维护人**: Aramis Jiang  
**说明**: 本文整理本次部署、登录修复、数据采集、权限调整与长期运维方案。敏感信息已脱敏。

---

## 一、总览

本次主要目标是完成 Embodied Marketing 首次上线后的稳定化工作，确保本地代码、GitHub 仓库、服务器部署版本保持一致，并解决飞书登录、页面无数据、自动采集失效、权限控制和长期采集稳定性问题。

最终结果：

- 线上服务已运行在 `http://101.200.222.139:8082`。
- 飞书扫码登录链路已修复。
- 数据库历史数据已迁移到服务器。
- `/api/trends` 因 `brands.is_self` 字段缺失导致的 500 已修复。
- 品牌管理权限已调整为：普通用户可添加品牌，只有管理员可删除品牌。
- 首页已增加管理员可见的「立即采集」按钮。
- Bilibili Cookie 已配置到线上真实运行环境。
- 每日自动采集 cron 已修复为可加载 `.env.local`。
- 本次手动数据采集已在服务器后台启动。

---

## 二、部署与代码一致性

### 2.1 代码源

- 本地项目路径：`/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing`
- GitHub 仓库：`https://github.com/aramisjiang-wq/embodied-marketing`
- 线上真实运行目录：`/opt/embodied-marketing`
- PM2 服务名：`embodied-marketing`
- Next.js 运行端口：`8082`

### 2.2 关键发现

服务器上曾同时存在根目录代码和 `bilibili-monitor/` 子目录代码。真实线上服务由 PM2 在 `/opt/embodied-marketing` 启动，因此：

- Next.js 读取 `/opt/embodied-marketing/.env.local`
- SQLite 数据库路径为 `/opt/embodied-marketing/bilibili_monitor.db`
- Cron 实际调用 `/opt/embodied-marketing/scripts/daily_collect.sh`
- Cron 实际执行 `/opt/embodied-marketing/scripts/collect_v2.py`

后续部署时应优先同步和构建 `/opt/embodied-marketing` 这个真实运行目录，避免只改子目录导致线上未生效。

---

## 三、飞书登录修复记录

### 3.1 初始问题

用户访问登录页后出现：

- `[Feishu Login] QR container not found`
- `Failed to fetch`
- 回调后跳转到 `http://0.0.0.0:8082`
- `Cannot read properties of undefined (reading 'access_token')`
- 登录成功后又回到登录页

### 3.2 修复内容

1. 登录页从旧的二维码 SDK 方案切换为直接跳转飞书授权 URL。
2. `exchangeCodeForToken` 兼容飞书 OAuth2 v2 token 接口的直接返回格式。
3. 回调地址统一使用 `NEXT_PUBLIC_BASE_URL`，避免 `0.0.0.0` 泄露到浏览器。
4. Session Cookie 的 `secure` 标记改为根据 `NEXT_PUBLIC_BASE_URL` 是否为 HTTPS 决定，避免 HTTP 环境下浏览器丢弃 Cookie。
5. Logout fallback 地址修正为 `http://localhost:8082`。

### 3.3 结果

飞书扫码登录已可正常进入系统。

---

## 四、用户管理与权限调整

### 4.1 用户入库逻辑

飞书登录成功后，系统会调用 `findOrCreateUser`：

- 第一个注册用户自动成为 `admin`
- 后续用户默认是 `viewer`
- 登录时更新 `last_login_at` 和 `login_count`
- 登录记录写入 `login_logs`

### 4.2 Ash 用户在后台不可见的原因

排查发现线上运行库 `/opt/embodied-marketing/bilibili_monitor.db` 的 `users` 表为空，但浏览器已有之前登录生成的 session，因此会出现「能进入后台，但用户列表为空」的情况。

已加自修复逻辑：

- 管理员访问 `/api/admin/users` 或 `/api/admin/users/stats` 时
- 如果当前 session 用户还没有写入 `users` 表
- 自动根据 session 内的飞书用户信息补写用户记录

刷新 `/admin` 后应能看到当前用户；若仍未出现，退出登录后重新扫码即可。

### 4.3 品牌权限调整

当前权限规则：

- 普通登录用户：可添加品牌
- 管理员：可删除品牌
- 前端品牌页：删除按钮仅管理员可见
- 后端删除接口：`DELETE /api/brands/[id]` 仅允许 `admin`
- 后端添加接口：`POST /api/brands` 允许所有已登录用户

### 4.4 手动采集按钮

首页「数据采集」卡片已增加「立即采集」按钮：

- 仅管理员可见
- 调用 `POST /api/collect`
- 采集运行中按钮禁用
- 状态每 5 秒自动刷新

---

## 五、数据展示与数据库修复

### 5.1 页面无数据与 500

页面请求 `/api/trends` 时返回 500，服务器日志显示：

```text
SqliteError: no such column: b.is_self
```

### 5.2 修复内容

在 `src/lib/db.ts` 中补充：

- `brands` 表新增 `is_self INTEGER DEFAULT 0`
- 初始化时检查旧库字段
- 如果缺失则执行 `ALTER TABLE brands ADD COLUMN is_self INTEGER DEFAULT 0`

### 5.3 历史数据迁移

本地历史数据已同步到服务器数据库。当前线上库路径：

```text
/opt/embodied-marketing/bilibili_monitor.db
```

数据库中已有品牌、视频、视频统计和品牌统计数据。

---

## 六、Bilibili 数据采集

### 6.1 采集脚本

核心脚本：

```text
/opt/embodied-marketing/scripts/collect_v2.py
```

本地对应文件：

```text
bilibili-monitor/scripts/collect_v2.py
```

### 6.2 Python 环境

服务器虚拟环境：

```text
/opt/embodied-marketing/venv
```

已安装：

- `bilibili-api-python`
- `aiohttp`

### 6.3 Bilibili Cookie 配置

线上真实环境文件：

```text
/opt/embodied-marketing/.env.local
```

已配置变量：

```text
BILIBILI_SESSDATA=***
BILIBILI_BILI_JCT=***
BILIBILI_BUVID3=***
```

注意：本文不记录完整 Cookie，避免泄露账号凭证。

本次 `SESSDATA` 内含过期时间：

```text
2026-11-06 00:30:06
```

但 Cookie 可能因退出登录、修改密码、账号风控提前失效。

### 6.4 采集结果观察

已验证 Cookie 能成功获取：

- B站用户基本信息
- 粉丝数

动态列表接口仍可能触发：

```text
412 Precondition Failed
```

这是 B站动态接口对服务器 IP 和请求指纹的额外风控，不代表 Cookie 未加载。

---

## 七、自动采集与手动采集

### 7.1 Cron 配置

当前服务器 cron：

```text
30 0 * * * /opt/embodied-marketing/scripts/daily_collect.sh
```

即每天 00:30 自动运行一次。

### 7.2 Cron 脚本修复

已修复 `/opt/embodied-marketing/scripts/daily_collect.sh`：

- 加载 `/opt/embodied-marketing/.env.local`
- 使用 `/opt/embodied-marketing/venv`
- 调用 `python3 scripts/collect_v2.py`
- 日志写入 `/opt/embodied-marketing/scripts/logs/`

### 7.3 本次手动采集

已在服务器后台启动本次手动采集。

日志路径：

```text
/opt/embodied-marketing/scripts/logs/manual_20260510_175456.log
```

可用以下命令查看进度：

```bash
ssh root@101.200.222.139
python3 - <<'PY'
from pathlib import Path
log = Path("/opt/embodied-marketing/scripts/logs/manual_20260510_175456.log")
print(log.read_text(errors="ignore")[-4000:])
PY
```

---

## 八、服务器上是否有 bilibili-api 开源代码

服务器上没有独立克隆的 `bilibili-api` 开源仓库。

当前使用的是 pip 包：

```text
bilibili-api-python
```

包安装在 Python 虚拟环境中：

```text
/opt/embodied-marketing/venv
```

---

## 九、长期稳定采集方案

### 9.1 当前方案

当前方案是「低频 cron + Bilibili Cookie + 失败日志巡检」：

- 每天凌晨自动采集一次
- 管理员可手动触发采集
- Cookie 放在 `.env.local`
- 日志落盘到 `scripts/logs`

### 9.2 风险点

主要风险：

- Cookie 非永久有效
- 动态接口可能触发 412
- 服务器 IP 可能被 B站风控
- `bilibili-api-python 16.x` 对浏览器指纹模拟支持有限

### 9.3 建议维护节奏

建议：

- 每周检查一次最近采集日志
- 每 3-5 个月主动更新一次 Bilibili Cookie
- 发现粉丝数、用户信息也开始失败时，优先更新 Cookie
- 动态列表长期 412 时，再接入代理池或浏览器指纹方案
- 增加采集失败告警，例如飞书消息或邮件通知

### 9.4 可升级方案

如果要进一步提升稳定性：

1. 接入稳定代理池，避免服务器固定 IP 被风控。
2. 使用支持 `curl_cffi` 或浏览器指纹模拟的采集方案。
3. 将采集拆分为「基础信息」和「动态视频」两类任务。
4. 对失败品牌做重试队列，不让单个品牌影响全量采集。
5. 增加采集健康面板：最近成功时间、失败原因、Cookie 到期倒计时。

---

## 十、已完成变更清单

代码层：

- 修复飞书 OAuth token 响应解析。
- 修复回调跳转使用 `0.0.0.0` 的问题。
- 修复 HTTP 环境 Session Cookie 被丢弃的问题。
- 修复 `/api/trends` 因 `is_self` 字段缺失导致的 500。
- 增加 `brands.is_self` 兼容迁移。
- 调整品牌添加和删除权限。
- 增加首页「立即采集」按钮。
- 兼容 `bilibili-api-python 16.x` 的 API 差异。
- 修复 `_credential` 全局初始化。
- 修复用户管理接口 session 自修复入库。

服务器层：

- 同步本地代码到服务器。
- 重新构建 Next.js。
- 使用 PM2 重启 `embodied-marketing`。
- 修复 Python venv。
- 安装 `bilibili-api-python`。
- 配置 Bilibili Cookie 到线上真实 `.env.local`。
- 修复 cron 真实执行脚本。
- 启动本次手动后台采集。

---

## 十一、后续待办

- 给采集失败增加飞书或邮件告警。
- 在后台显示 Cookie 到期时间和采集健康状态。
- 将服务器部署路径规范化，减少根目录和子目录混用。
- 若 B站动态接口持续 412，评估代理池或浏览器指纹方案。
- 将服务器敏感配置统一纳入 `.env.local` 管理，文档只记录变量名不记录值。

---

## 十二、结论

本次运维后，Embodied Marketing 已完成首次上线后的核心稳定化：登录可用、数据可展示、历史数据已迁移、权限已收敛、自动采集和手动采集路径已修复。后续稳定性的关键在于 Bilibili Cookie 的周期性维护、采集日志巡检，以及对 412 风控的持续观察和升级。
