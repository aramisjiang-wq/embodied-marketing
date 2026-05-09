# B站竞品数据采集系统 - 定时任务配置指南

## 📅 数据更新规则

**更新频率**: **每天 00:00 (零点) 自动运行一次**

### 数据时效性说明

| 数据类型 | 更新时间 | 说明 |
|---------|---------|------|
| 粉丝数/关注数 | 每天零点 | 反映前一天结束时的数据 |
| 视频列表 | 每天零点 | 包含最近30-60天发布的视频 |
| 视频播放量 | 每天零点 | 各视频的最新播放数据 |
| 月度统计 | 每天零点 | 基于最新数据重新计算 |

---

## ⚙️ 配置方法（二选一）

### 方法A：使用 crontab（推荐）

#### Step 1: 打开终端编辑 crontab

```bash
crontab -e
```

#### Step 2: 在文件末尾添加以下行

```
# B站竞品数据采集 - 每天零点执行
0 0 * * * /Users/dong/Downloads/Codebase/LimX\ Code/Embodied\ Marketing/bilibili-monitor/scripts/daily_collect.sh >> /Users/dong/Downloads/Codebase/LimX\ Code/Embodied\ Marketing/bilibili-monitor/scripts/logs/cron.log 2>&1
```

#### Step 3: 保存退出

- 按 `:wq` 保存并退出（如果是 vim）
- 或按 `Ctrl+O` 然后 `Ctrl+X`（如果是 nano）

#### Step 4: 验证配置

```bash
# 查看已配置的定时任务
crontab -l

# 应该能看到刚才添加的行
```

---

### 方法B：使用 launchd（macOS 原生）

#### Step 1: 创建 plist 文件

```bash
cat > ~/Library/LaunchAgents/com.bilibili-monitor.daily.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.bilibili-monitor.daily</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/scripts/daily_collect.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>0</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/scripts/logs/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/scripts/logs/launchd_error.log</string>
</dict>
</plist>
EOF
```

#### Step 2: 加载任务

```bash
# 加载定时任务
launchctl load ~/Library/LaunchAgents/com.bilibili-monitor.daily.plist

# 立即测试执行一次（可选）
launchctl start com.bilibili-monitor.daily

# 查看任务状态
launchctl list | grep bilibili
```

#### Step 3: 管理任务

```bash
# 停止任务
launchctl stop com.bilibili-monitor.daily

# 卸载任务（不再自动执行）
launchctl unload ~/Library/LaunchAgents/com.bilibili-monitor.daily.plist
```

---

## ✅ 验证定时任务是否正常工作

### 方法1: 手动触发测试

```bash
# 运行一次采集脚本（不等待到零点）
cd "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/scripts"
source ../venv/bin/activate && python collect.py
```

### 方法2: 查看日志确认

```bash
# 查看最新的 cron 日志
ls -lt scripts/logs/cron_* | head -1 | xargs tail -50

# 或者查看今天的日志
tail -f scripts/logs/cron_$(date +%Y%m%d)*.log
```

### 方法3: 检查数据库更新时间

```bash
sqlite3 bilibili_monitor.db "SELECT MAX(run_time) FROM run_logs;"
```

如果显示今天的时间，说明定时任务正常运行！

---

## 🔧 故障排除

### 问题1: 定时任务未执行

**检查步骤**:
```bash
# 1. 确认 cron 服务正在运行
sudo launchctl list | grep cron

# 2. 查看 cron 日志是否有错误
tail -100 /var/log/cron.log 2>/dev/null || echo "无法访问系统cron日志"

# 3. 手动执行脚本查看是否报错
./daily_collect.sh
echo "退出码: $?"
```

### 问题2: 脚本执行但数据未更新

**检查步骤**:
```bash
# 1. 检查 Python 环境
source venv/bin/activate && python --version
# 应输出: Python 3.11.x

# 2. 测试导入依赖
python -c "from bilibili_api import user; print('OK')"

# 3. 查看详细错误日志
ls -lt logs/*.log | head -5
```

### 问题3: 权限问题

**解决方案**:
```bash
# 确保脚本有执行权限
chmod +x scripts/daily_collect.sh
chmod +x scripts/collect.py

# 如果使用 crontab，确保路径正确（不要用 ~）
crontab -e
# 使用完整绝对路径！
```

---

## 📊 监控建议

### 推荐的监控脚本（可选）

创建 `scripts/check_status.sh`:
```bash
#!/bin/bash
# 检查数据采集状态

DB="bilibili_monitor.db"
TODAY=$(date +%Y-%m-%d)

echo "📊 B站竞品监控系统状态检查"
echo "================================"
echo ""

# 最后采集时间
LAST_RUN=$(sqlite3 $DB "SELECT MAX(run_time) FROM run_logs;")
echo "⏰ 最后采集时间: $LAST_RUN"

# 今日是否已采集
TODAY_COUNT=$(sqlite3 $DB "SELECT COUNT(*) FROM run_logs WHERE DATE(run_time) = '$TODAY';")
if [ "$TODAY_COUNT" -gt 0 ]; then
    echo "✅ 今天已完成采集 ($TODAY_COUNT 次)"
else
    echo "⚠️  今天尚未采集"
fi

# 数据总量
VIDEO_COUNT=$(sqlite3 $DB "SELECT COUNT(*) FROM videos;")
BRAND_COUNT=$(sqlite3 $DB "SELECT COUNT(*) FROM brands;")
echo ""
echo "📈 数据概况:"
echo "   品牌: $BRAND_COUNT 个"
echo "   视频: $VIDEO_COUNT 个"

# 最近7天采集记录
echo ""
echo "📅 近期采集历史:"
sqlite3 $DB "
    SELECT 
        date(run_time) as date,
        duration,
        success_count,
        failed_count,
        total_videos
    FROM run_logs 
    WHERE run_time > datetime('now', '-7 days')
    ORDER BY run_time DESC;
" | while IFS='|' read date dur suc fail vid; do
    echo "   $date | ${dur}s | 成功:$suc 失败:$fail | 视频:$vid"
done
```

---

## 📝 重要提醒

1. **首次运行前**：确保虚拟环境已创建且依赖已安装
2. **日志轮转**：建议每月清理一次旧日志文件
3. **手动采集**：随时可以手动运行 `python collect.py`，不会与定时任务冲突
4. **数据备份**：定期备份数据库文件 `bilibili_monitor.db`
5. **监控告警**：可以结合企业微信/钉钉机器人，在采集失败时发送通知

---

## 💡 最佳实践

### ✅ 推荐
- ✅ 使用 **crontab**（简单可靠）
- ✅ 设置 **每天零点** 执行（低峰时段）
- ✅ **保留所有日志** 方便排查问题
- ✅ 定期 **检查日志** 和 **数据库**

### ❌ 不推荐
- ❌ 设置太频繁（每小时或更短）可能触发B站风控
- ❌ 忽略日志文件大小（会占满磁盘）
- ❌ 不做错误处理（失败后无法知道）
- ❌ 不备份数据（丢失后无法恢复）

---

**祝您配置顺利！如有问题请查看本文档或日志文件。** 🚀
