# B站竞品监控方案讨论记录

> 日期：2026-05-06
> 参与：用户、Assistant
> 目的：机器人公司市场部竞品B站矩阵监控方案

---

## 一、业务需求确认

### 1.1 用户场景
- **用户角色**：机器人公司市场部（内部团队使用）
- **监控规模**：30-50个机器人品牌，最终扩展到50-100个
- **用户数量**：6-7人团队 + 领导
- **核心目标**：监控竞品在B站的官方账号矩阵

### 1.2 核心数据需求

| 数据维度 | 具体需求 |
|----------|----------|
| 月度发布数量 | 每个品牌每月发几个视频 |
| 月度播放量 | 每个品牌每月视频播放量总和 |
| 粉丝增长 | 每月粉丝数变化 |
| 互动数据 | 点赞、收藏、评论、投币 |

### 1.3 业务目标
市场部需要回答的问题：
1. 竞品在B站上声量有多大？
2. 竞品的内容策略是什么？
3. 下个月应该找谁合作？

---

## 二、技术方案探索

### 2.1 技术选型

**使用库**：`nemo2011/bilibili-api`
- GitHub: https://github.com/nemo2011/bilibili-api
- 400+ API接口
- 全异步架构
- 支持curl_cffi浏览器伪装

### 2.2 初始测试结果

| 接口 | 状态 | 说明 |
|------|------|------|
| 用户基本信息 | ✅ | 正常 |
| 粉丝/关注数 | ✅ | 正常 |
| 视频列表 get_videos() | ❌ | **触发412风控拦截** |
| 视频详情 video.get_info() | ✅ | 正常 |
| 数据总览 | ✅ | 正常 |
| 用户动态 get_dynamics_new() | ✅ | 正常 |

### 2.3 问题分析

`get_videos()` 接口被B站风控拦截，错误信息：
```
错误号: 412
原因：由于触发哔哩哔哩安全风控策略，该次访问请求被拒绝。
```

---

## 三、解决方案验证

### 3.1 curl_cffi浏览器伪装测试

启用curl_cffi伪装模式：
```python
from bilibili_api import select_client, request_settings

select_client("curl_cffi")
request_settings.set("impersonate", "chrome131")
```

**结果**：
- 用户信息、粉丝数、视频详情等接口稳定
- `get_videos()` 仍然被拦截
- `get_dynamics_new()` 保持稳定

### 3.2 动态接口作为替代方案

**重大发现**：`get_dynamics_new()` 可以替代 `get_videos()`

测试验证结果：
```
动态数: 12
提取到的视频数: 5
bvid: BV1baRvBSErd
title: 【翻跳】就算察觉也为时已晚
pub_ts: 1777953614  ← 时间戳正常获取
```

### 3.3 数据提取路径

从动态接口提取视频信息的字段映射：
```python
# 动态列表
dynamics = await user.get_dynamics_new()

# 遍历动态
for item in dynamics.get('items', []):
    if item.get('type') == 'DYNAMIC_TYPE_AV':
        modules = item.get('modules', {})
        author = modules.get('module_author', {})
        major = modules.get('module_dynamic', {}).get('major', {})

        if major.get('type') == 'MAJOR_TYPE_ARCHIVE':
            archive = major.get('archive', {})
            bvid = archive.get('bvid')        # 视频ID
            title = archive.get('title')     # 视频标题
            pub_ts = author.get('pub_ts')     # 发布时间戳
```

### 3.4 方案对比

| 对比项 | get_videos() | get_dynamics_new() |
|--------|---------------|-------------------|
| 代理IP | 必须 | **不需要** |
| 稳定性 | ❌ 被拦截 | ✅ **稳定** |
| 时间戳 | - | ✅ `pub_ts` 有 |
| 自动去重 | 需比对 | ✅ 天然去重 |
| 内容类型 | 仅视频 | 含图文等多种 |

---

## 四、最终技术方案

### 4.1 数据流架构

```
50个品牌账号
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  1. get_dynamics_new() 获取最新动态                 │
│     └── ✅ 稳定可用，无需代理                       │
│                                                       │
│  2. 从动态中提取:                                    │
│     ├── bvid (视频ID)                               │
│     ├── title (标题)                               │
│     ├── pub_ts (发布时间戳)                        │
│     └── 天然去重 (动态ID不重复)                    │
│                                                       │
│  3. 对新视频调用 video.get_info()                   │
│     └── ✅ 稳定可用                                 │
│                                                       │
│  4. 每日快照存储                                    │
│                                                       │
│  5. 自己按月聚合统计                                 │
└──────────────────────────────────────────────────────┘
```

### 4.2 数据覆盖

| 数据项 | 来源 | 状态 |
|--------|------|------|
| 视频bvid | 动态.major.archive.bvid | ✅ |
| 视频标题 | 动态.major.archive.title | ✅ |
| 发布时间 | 动态.module_author.pub_ts | ✅ |
| 播放量 | video.get_info().stat.view | ✅ |
| 点赞/收藏/评论 | video.get_info().stat | ✅ |
| 粉丝数 | get_relation_info().follower | ✅ |

### 4.3 月度统计实现

通过发布时间戳按月聚合：
```python
from datetime import datetime

def get_month(timestamp):
    dt = datetime.fromtimestamp(int(timestamp))
    return dt.strftime('%Y-%m')

# 聚合
monthly_stats = {}
for video in videos:
    month = get_month(video['pub_ts'])
    if month not in monthly_stats:
        monthly_stats[month] = {'count': 0, 'views': 0}
    monthly_stats[month]['count'] += 1
    monthly_stats[month]['views'] += video['views']
```

---

## 五、技术栈确认

### 5.1 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 16 + TypeScript | AI开发友好 |
| UI组件 | shadcn/ui + Tailwind | 好看且可定制 |
| 数据库 | SQLite | 趋势数据永久保留 |
| 数据采集 | Python bilibili-api | 稳定的数据获取 |
| 部署 | Vercel / 本地 | 灵活 |

### 5.2 更新频率策略

| 数据类型 | 更新频率 | 说明 |
|----------|----------|------|
| 粉丝/关注数 | 每6小时 | 轻度请求 |
| 视频列表/播放量 | 每日 | 批量请求 |
| 历史趋势 | 永久保留 | 增量更新 |

---

## 六、产品功能规划

### 6.1 MVP功能（必须）

| 功能 | 说明 |
|------|------|
| UP主管理 | 增删改查监控账号 |
| 数据可视化 | 播放/粉丝/发布量 |
| 月度趋势 | 过去24个月历史 |

### 6.2 扩展功能（可能）

| 功能 | 说明 |
|------|------|
| 竞品对比 | 自己 vs 竞品 |
| 数据导出 | Excel/PDF |

---

## 七、项目结构

```
bilibili-monitor/
├── scripts/
│   └── collect.py          # Python数据采集脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── brands/     # 品牌管理API
│   │   │   ├── compare/    # 对比API
│   │   │   ├── collect/    # 采集触发API
│   │   │   └── overview/   # 总览API
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── collector.ts    # 采集器调用
│       ├── db.ts           # 数据库操作
│       └── types.ts        # TypeScript类型
├── bilibili_monitor.db     # SQLite数据库
└── package.json
```

---

## 八、API接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/brands` | GET | 获取所有品牌 |
| `/api/brands` | POST | 添加品牌 |
| `/api/brands/[id]` | GET | 获取单个品牌 |
| `/api/brands/[id]` | PUT | 更新品牌 |
| `/api/brands/[id]` | DELETE | 删除品牌 |
| `/api/overview` | GET | 获取总览数据 |
| `/api/compare` | GET | 获取对比数据 |
| `/api/collect` | POST | 触发数据采集 |

---

## 九、数据库表结构

### brands
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| mid | TEXT | B站 MID |
| name | TEXT | 品牌名称 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### videos
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| bvid | TEXT | 视频BV号 |
| brand_id | INTEGER | 品牌ID |
| title | TEXT | 视频标题 |
| pub_ts | INTEGER | 发布时间戳 |
| pub_date | DATE | 发布日期 |

### video_stats
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| video_id | INTEGER | 视频ID |
| stat_date | DATE | 统计日期 |
| view | INTEGER | 播放量 |
| like | INTEGER | 点赞数 |
| coin | INTEGER | 投币数 |
| favorite | INTEGER | 收藏数 |
| reply | INTEGER | 评论数 |
| danmaku | INTEGER | 弹幕数 |
| share | INTEGER | 分享数 |

### brand_stats
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| brand_id | INTEGER | 品牌ID |
| stat_date | DATE | 统计日期 |
| follower | INTEGER | 粉丝数 |
| following | INTEGER | 关注数 |

---

## 十、已完成项

- [x] 技术可行性验证
- [x] 数据采集稳定性确认
- [x] Next.js项目初始化
- [x] 数据库表结构设计
- [x] API接口开发
- [x] 数据采集脚本编写

## 十一、待完成项

- [ ] 确认50-100个品牌MID
- [ ] 前端界面开发
- [ ] 定时任务配置
- [ ] 数据可视化

---

*文档更新时间：2026-05-06*
