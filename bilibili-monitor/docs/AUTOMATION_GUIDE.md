# 数据采集自动化配置指南

## 📊 当前状态

### ✅ 已完成
- [x] 采集脚本 `collect.py` 工作正常
- [x] 历史日志记录到数据库 `run_logs` 表
- [x] 前端展示组件 `CollectProgress` 支持历史记录查看
- [x] 状态文件正确更新（已修复 is_running bug）

### ⚠️ 需要配置
- [ ] **定时任务未启用** - 需要手动配置 launchd

---

## 🔧 配置定时任务（macOS launchd）

### 方法1：使用 launchd（推荐）

macOS 推荐使用 launchd 管理定时任务，比 cron 更可靠。

#### 步骤1：复制 plist 文件到 LaunchAgents
```bash
cp scripts/com.bilibili-monitor.daily-collect.plist ~/Library/LaunchAgents/
```

#### 步骤2：加载任务
```bash
launchctl load ~/Library/LaunchAgents/com.bilibili-monitor.daily-collect.plist
```

#### 步骤3：验证任务已加载
```bash
launchctl list | grep bilibili-monitor
```

#### 其他管理命令
```bash
# 卸载任务
launchctl unload ~/Library/LaunchAgents/com.bilibili-monitor.daily-collect.plist

# 手动触发一次运行（测试用）
launchctl start com.bilibili-monitor.daily-collect

# 查看任务状态
launchctl list com.bilibili-monitor.daily-collect
```

### 方法2：使用 crontab（备选）

如果不想使用 launchd，可以用传统 cron：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 00:05 执行）
5 0 * * * /Users/dong/Downloads/Codebase/LimX\ Code/Embodied\ Marketing/bilibili-monitor/scripts/daily_collect.sh >> /Users/dong/Downloads/Codebase/LimX\ Code/Embodied\ Marketing/bilibili-monitor/scripts/logs/cron.log 2>&1
```

---

## 📈 监控与日志

### 1. 数据库历史记录
查询最近5次采集记录：
```sql
SELECT * FROM run_logs ORDER BY id DESC LIMIT 5;
```

**示例输出**：
| id | run_time | duration | total_brands | success | failed | videos |
|----|----------|----------|--------------|---------|--------|--------|
| 4 | 2026-05-07 02:11:21 | 2019.2s | 13 | 13 | 0 | 272 |
| 3 | 2026-05-06 13:52:08 | 1820.3s | 14 | 14 | 0 | 243 |

### 2. 日志文件位置
- **实时日志**: `scripts/logs/collect.log` - 最新的详细采集日志
- **Cron日志**: `scripts/logs/cron_YYYYMMDD_HHMMSS.log` - 每次定时任务的完整输出
- **Launchd日志**:
  - `scripts/logs/launchd.stdout.log` - 标准输出
  - `scripts/logs/launchd.stderr.log` - 错误输出

### 3. Web界面查看
访问 http://localhost:3000 ，在"数据采集"卡片中：
- 点击右侧 **"历史"** 按钮 → 查看10条最近的采集记录
- 点击 **"详情"** 按钮 → 查看实时日志（采集中时可用）
- 底部显示 **"上次更新时间"**

---

## ✅ 稳定性保障措施

### 1. 自动重试机制
- 最大重试次数：3次
- 指数退避策略：30s → 60s → 120s
- 针对风控错误（412/-352）自动等待后重试

### 2. 智能延迟
- 页面间延迟：3-6秒（随机）
- 视频间延迟：1-2秒（随机）
- 品牌间延迟：8-17秒（随机）+ 15%概率额外休息10-20秒
- 出错后冷静期：30-60秒

### 3. 双数据源备份
- 主接口：`get_dynamics_new()` （动态列表）
- 备用接口：`get_video()` （视频列表）
- 当主接口返回0时自动切换到备用接口

### 4. 浏览器指纹伪装
- 使用 curl_cffi 客户端
- 伪装为 Chrome 131 浏览器
- 降低被B站风控的概率

---

## 🔍 故障排查

### 问题1：状态一直显示"采集中"
**原因**: 脚本异常退出导致 `clear_status()` 未执行
**解决**:
```bash
# 手动重置状态
cat > scripts/collect_status.json << 'EOF'
{
  "is_running": false,
  "started_at": null,
  "current_brand": null,
  "current_brand_progress": "0/0",
  "total_brands": 0,
  "completed_brands": 0,
  "current_step": "空闲",
  "message": "系统就绪",
  "logs": []
}
EOF
```

### 问题2：某些品牌采集失败
**常见原因**:
- 品牌无公开视频或API受限（如"逐际动力"、"优必选科技"）
- 触发B站风控（412错误）

**解决方案**:
- 脚本会自动跳过并记录失败品牌
- 查看日志确认具体原因：`tail -100 scripts/logs/collect.log`

### 问题3：定时任务没有执行
**检查步骤**:
1. 确认 launchd 任务已加载：`launchctl list | grep bilibili`
2. 查看错误日志：`tail -50 scripts/logs/launchd.stderr.log`
3. 手动运行脚本测试：`cd scripts && python collect.py`

---

## 📊 性能指标参考

基于最近4次运行的统计数据：

| 指标 | 平均值 | 范围 |
|------|--------|------|
| 总耗时 | ~33分钟 | 19-34分钟 |
| 成功率 | 100% | 13/13, 14/14 品牌 |
| 视频采集量 | ~252个/次 | 243-272个 |
| 单品牌耗时 | ~2.5分钟 | 1-8分钟 |

---

## 🎯 下一步优化建议

1. **添加健康检查接口**
   ```typescript
   // GET /api/system-status
   // 返回: { last_run_time, next_run_time, consecutive_failures }
   ```

2. **失败告警通知**
   - 当连续2次采集失败时发送邮件/Webhook通知
   - 可使用 SendGrid 或企业微信机器人

3. **数据质量报告**
   - 定期生成采集覆盖率报告
   - 标记长时间未更新的品牌

4. **性能优化**
   - 并行采集多个品牌（需控制并发度避免风控）
   - 增量更新：只采集有新动态的品牌

---

## 📝 维护清单

### 每周检查
- [ ] 查看 `/api/collect-history` 确认定时任务正常
- [ ] 检查 `logs/collect.log` 有无异常错误
- [ ] 确认所有品牌都有最新数据

### 每月维护
- [ ] 清理超过30天的旧日志文件
- [ ] 检查数据库大小，必要时归档旧数据
- [ ] 更新品牌列表（新增/移除监控品牌）

---

**最后更新**: 2026-05-08
**维护者**: AI Assistant
