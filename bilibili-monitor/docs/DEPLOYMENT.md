# 服务器部署指南 (Server Deployment Guide)

> **适用版本**: v2.20.0+
> **更新日期**: 2026-05-08
> **目标环境**: Linux服务器（Ubuntu 22.04+ / Debian 12+ / CentOS 8+）

---

## 📦 新增文件清单

本版本新增以下文件以支持服务器部署：

### 核心配置文件

| 文件路径 | 用途 | 适用平台 |
|---------|------|---------|
| `scripts/com.bilibili-monitor.daily-collect.plist` | macOS launchd定时任务配置 | macOS（开发环境） |
| `scripts/bilibili-monitor.service` | Linux systemd服务单元文件 | Linux（生产环境） |
| `scripts/deploy-to-server.sh` | 一键部署脚本 | Linux |

### 文档文件

| 文件路径 | 说明 |
|---------|------|
| `docs/AUTOMATION_GUIDE.md` | 完整的自动化运维指南（~400行） |
| `docs/DEPLOYMENT.md` | 本文件 - 服务器部署专项指南 |

---

## 🚀 快速部署（3种方式）

### 方式1：一键部署脚本（推荐）

**适合场景**：全新部署、快速上手

```bash
# 1. 上传项目到服务器
scp -r bilibili-monitor user@your-server:/tmp/

# 2. SSH登录服务器
ssh user@your-server

# 3. 切换为root用户
sudo su -

# 4. 运行一键部署脚本
cd /tmp/bilibili-monitor
chmod +x scripts/deploy-to-server.sh
./scripts/deploy-to-server.sh

# 5. 部署完成后，手动触发一次测试
sudo systemctl start bilibili-monitor

# 6. 查看日志确认运行正常
sudo journalctl -u bilibili-monitor -f
```

**脚本功能**：
- ✅ 自动检测系统环境（OS、Python、Systemd）
- ✅ 创建专用服务用户（www-data）
- ✅ 创建目录结构并设置权限
- ✅ 创建Python虚拟环境并安装依赖
- ✅ 配置Systemd服务并启用开机自启
- ✅ 配置日志轮转（保留30天）
- ✅ 验证采集脚本语法正确性

---

### 方式2：手动分步部署

**适合场景**：需要自定义配置、已有项目文件

#### 步骤1：上传项目文件

```bash
# 在本地执行
scp -r bilibili-monitor/ user@your-server:/opt/

# 或使用rsync（增量同步，更快）
rsync -avz --progress bilibili-monitor/ user@your-server:/opt/bilibili-monitor/
```

#### 步骤2：SSH登录服务器并配置

```bash
ssh user@your-server
sudo su -
```

#### 步骤3：安装系统依赖

```bash
# Ubuntu/Debian
apt update
apt install -y python3 python3-pip python3-venv sqlite3

# CentOS/RHEL
yum install -y python3 python3-pip python3-venv sqlite
```

#### 步骤4：创建虚拟环境并安装依赖

```bash
cd /opt/bilibili-monitor/scripts

# 创建虚拟环境
python3 -m venv ../venv

# 激活虚拟环境
source ../venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install -r requirements.txt

# 验证关键依赖
python -c "import better_sqlite3; print('✅ SQLite OK')"
python -c "from bilibili_api import user; print('✅ Bilibili API OK')"

deactivate
```

#### 步骤5：配置Systemd服务

```bash
# 复制服务文件
cp /opt/bilibili-monitor/scripts/bilibili-monitor.service /etc/systemd/system/

# 修改路径（如果安装目录不是/opt/bilibili-monitor）
sed -i 's|/opt/bilibili-monitor|/你的实际路径|g' /etc/systemd/system/bilibili-monitor.service

# 重载配置
systemctl daemon-reload

# 启用开机自启
systemctl enable bilibili-monitor.service

# 启动服务（立即执行一次采集）
systemctl start bilibili-monitor.service
```

#### 步骤6：验证部署

```bash
# 查看服务状态
systemctl status bilibili-monitor.service

# 查看实时日志
journalctl -u bilibili-monitor -f

# 查看最近的日志
journalctl -u bilibili-monitor --since "1 hour ago"
```

---

### 方式3：Docker容器化部署（高级）

**适合场景**：需要隔离环境、快速扩缩容

#### Dockerfile 示例

```dockerfile
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY . .

# 创建虚拟环境并安装依赖
RUN python3 -m venv venv && \
    ./venv/bin/pip install --upgrade pip && \
    ./venv/bin/pip install -r requirements.txt

# 创建日志目录
RUN mkdir -p logs

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV DB_PATH=/app/bilibili_monitor.db
ENV LOG_DIR=/app/logs

# 使用entrypoint脚本
COPY scripts/docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["collect.py"]
```

#### docker-entrypoint.sh

```bash
#!/bin/bash
set -e

echo "========================================"
echo " B站竞品监控系统 - Docker容器启动"
echo " 时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 执行采集
/app/venv/bin/python /app/scripts/collect.py

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ 采集完成"
else
    echo "❌ 采集失败 (退出码: $EXIT_CODE)"
fi

exit $EXIT_CODE
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  bilibili-monitor:
    build: .
    container_name: bilibili-monitor
    restart: unless-stopped
    volumes:
      - ./data:/app           # 项目文件
      - ./logs:/app/logs      # 日志持久化
      - ./db:/app/db          # 数据库持久化
    environment:
      - TZ=Asia/Shanghai
      - PYTHONUNBUFFERED=1
    # 定时任务：每天凌晨00:05执行（使用host的cron或外部调度器）
    # 注意：Docker容器本身不适合运行cron，建议使用宿主机或Kubernetes CronJob
```

#### 运行命令

```bash
# 构建镜像
docker build -t bilibili-monitor:v2.20.0 .

# 运行容器（手动触发）
docker run --rm -v $(pwd)/data:/app -v $(pwd)/logs:/app/logs bilibili-monitor:v2.20.0

# 或使用docker-compose
docker-compose up -d

# 手动执行采集
docker exec bilibili-monitor /app/venv/bin/python /app/scripts/collect.py
```

---

## ⏰ 定时任务配置详解

### Systemd Timer vs Cron vs Launchd

| 特性 | Systemd Timer | Cron | Launchd |
|------|--------------|------|----------|
| **平台** | Linux | 跨平台 | macOS |
| **日志集成** | ✅ journalctl | ❌ 需自行配置 | ❌ 需自行配置 |
| **失败重试** | ✅ 内置支持 | ❌ 不支持 | ⚠️ 有限支持 |
| **资源限制** | ✅ 完整支持 | ❌ 不支持 | ✅ 基本支持 |
| **依赖管理** | ✅ After/Before | ❌ 无 | ⚠️ 基础支持 |
| **易用性** | 中等 | 简单 | 中等 |

**推荐**：
- 开发环境（macOS）：使用 **Launchd**
- 生产环境（Linux）：使用 **Systemd Timer**

---

### Systemd Timer 配置（生产环境推荐）

除了Service文件外，还需要Timer文件来实现定时执行。

#### 创建Timer文件

**文件路径**：`/etc/systemd/system/bilibili-monitor.timer`

```ini
[Unit]
Description=Bilibili Monitor - Daily Collection Timer
Requires=bilibili-monitor.service

[Timer]
# 每天凌晨 00:05 执行（避开整点高峰）
OnCalendar=*-*-* 00:05:00
# 随机延迟0-300秒（避免多台服务器同时执行）
AccuracySec=300s
# 如果错过时间（如关机），启动后立即补执行
Persistent=true

[Install]
WantedBy=timers.target
```

#### 启用Timer

```bash
# 复制Timer文件
cp scripts/bilibili-monitor.timer /etc/systemd/system/

# 重载配置
systemctl daemon-reload

# 启用Timer（开机自启）
systemctl enable bilibili-monitor.timer

# 启动Timer（开始计时）
systemctl start bilibili-monitor.timer

# 查看所有Timers
systemctl list-timers --all

# 查看下次执行时间
systemctl list-timers bilibili-monitor.timer
```

#### 手动触发测试

```bash
# 触发一次执行（不等待定时器）
systemctl start bilibili-monitor.service

# 或者模拟Timer触发
systemctl trigger bilibili-monitor.timer
```

---

## 🔧 生产环境优化建议

### 1. 性能调优

#### Systemd资源配置（已在service文件中配置）

```ini
# 内存限制
MemoryMax=2G

# CPU限制（使用80%CPU，留20%给其他进程）
CPUQuota=80%

# 单次运行超时（正常约33分钟，设置1小时上限）
TimeoutStartSec=3600
```

#### Python优化

```bash
# 在collect.py开头添加（可选）
import sys
sys.setrecursionlimit(10000)  # 增加递归深度限制
```

### 2. 安全加固

#### 文件权限

```bash
# 数据库文件：仅服务用户可读写
chmod 640 /opt/bilibili-monitor/*.db

# 日志文件：所有者可读写，组可读
chmod 640 /opt/bilibili-monitor/logs/*.log

# 配置文件：所有者可读写
chmod 600 /opt/bilibili-monitor/scripts/collect_status.json
```

#### 网络安全

```bash
# 如果仅需内网访问Web界面，配置防火墙
ufw allow from 10.0.0.0/8 to any port 3000

# 或使用Nginx反向代理 + HTTPS
# （需要额外配置SSL证书）
```

### 3. 监控与告警

#### 健康检查脚本

创建 `/opt/bilibili-monitor/scripts/health-check.sh`：

```bash
#!/bin/bash
# 健康检查脚本 - 可配合Nagios/Zabbix/Prometheus使用

DB_PATH="/opt/bilibili-monitor/bilibili_monitor.db"
STATUS_FILE="/opt/bilibili-monitor/scripts/collect_status.json"

# 检查1：数据库是否存在且可访问
if [ ! -f "$DB_PATH" ]; then
    echo "CRITICAL: 数据库文件不存在"
    exit 2
fi

sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM brands;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "CRITICAL: 数据库无法访问"
    exit 2
fi

# 检查2：状态文件是否正常
if [ ! -f "$STATUS_FILE" ]; then
    echo "WARNING: 状态文件不存在（可能尚未运行）"
    exit 1
fi

IS_RUNNING=$(grep '"is_running": true' "$STATUS_FILE" || true)
if [ -n "$IS_RUNNING" ]; then
    # 正在运行是正常的（除非超过2小时）
    START_TIME=$(grep '"started_at"' "$STATUS_FILE" | head -1 | cut -d'"' -f4)
    if [ -n "$START_TIME" ]; then
        START_EPOCH=$(date -d "$START_TIME" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$START_TIME" +%s)
        NOW_EPOCH=$(date +%s)
        DIFF=$(( (NOW_EPOCH - START_EPOCH) / 3600 ))
        if [ $DIFF -gt 2 ]; then
            echo "WARNING: 采集任务运行超过2小时，可能卡住"
            exit 1
        fi
    fi
fi

# 检查3：最近24小时内是否有成功记录
LAST_RUN=$(sqlite3 "$DB_PATH" "SELECT run_time FROM run_logs ORDER BY id DESC LIMIT 1;" 2>/dev/null)
if [ -n "$LAST_RUN" ]; then
    LAST_EPOCH=$(date -d "$LAST_RUN" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    DIFF_HOURS=$(( (NOW_EPOCH - LAST_EPOCH) / 3600 ))
    if [ $DIFF_HOURS -gt 26 ]; then
        echo "WARNING: 超过26小时未成功运行"
        exit 1
    fi
fi

echo "OK: 所有检查通过"
exit 0
```

#### 企业微信告警（示例）

```python
# scripts/send_alert.py
import requests
import json
import sys
from datetime import datetime

WEBHOOK_URL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY"

def send_alert(title, content, level="warning"):
    """发送企业微信告警"""
    color = {
        "info": "info",
        "warning": "warning",
        "error": "red"
    }.get(level, "info")

    payload = {
        "msgtype": "markdown",
        "markdown": {
            "content": f"""### <font color="{color}">{title}</font>
{content}

> 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        }
    }

    try:
        resp = requests.post(WEBHOOK_URL, json=payload, timeout=10)
        if resp.status_code == 200:
            print("✅ 告警发送成功")
        else:
            print(f"❌ 告警发送失败: {resp.text}")
    except Exception as e:
        print(f"❌ 发送异常: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python send_alert.py <标题> <内容> [级别]")
        sys.exit(1)

    title = sys.argv[1]
    content = sys.argv[2]
    level = sys.argv[3] if len(sys.argv) > 3 else "warning"

    send_alert(title, content, level)
```

---

## 📊 监控面板集成

### Prometheus + Grafana（可选）

如果团队已使用Prometheus监控，可以添加采集任务监控：

#### Prometheus Exporter（简化版）

创建 `/opt/bilibili-monitor/scripts/metrics_exporter.py`：

```python
#!/usr/bin/env python3
"""简单的Prometheus metrics导出器"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sqlite3
import os

METRICS_PORT = 9101
DB_PATH = os.environ.get("DB_PATH", "/opt/bilibili-monitor/bilibili_monitor.db")

class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()

            metrics = self.collect_metrics()
            self.wfile.write(metrics.encode())
        else:
            self.send_response(404)
            self.end_headers()

    def collect_metrics(self):
        """收集指标"""
        lines = []

        # 采集状态
        try:
            with open("/opt/bilibili-monitor/scripts/collect_status.json") as f:
                status = json.load(f)
                is_running = 1 if status.get("is_running") else 0
                lines.append(f"# HELP bilibili_collect_is_running Current collection status\n")
                lines.append(f"# TYPE bilibili_collect_is_running gauge\n")
                lines.append(f"bilibili_collect_is_running {is_running}\n")
        except:
            pass

        # 历史统计
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) FROM run_logs WHERE run_time > datetime('now', '-24 hours')")
            last_24h_runs = cursor.fetchone()[0]
            lines.append(f"\n# HELP bilibili_runs_last_24h Runs in last 24 hours\n")
            lines.append(f"# TYPE bilibili_runs_last_24h gauge\n")
            lines.append(f"bilibili_runs_last_24h {last_24h_runs}\n")

            conn.close()
        except Exception as e:
            lines.append(f"# Error collecting DB metrics: {e}\n")

        return "\n".join(lines)

    def log_message(self, format, *args):
        pass  # 禁止访问日志

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", METRICS_PORT), MetricsHandler)
    print(f"Metrics server running on port {METRICS_PORT}")
    server.serve_forever()
```

#### Grafana Dashboard JSON（示例）

可在Grafana中导入此JSON创建监控面板。

---

## 🔄 升级与回滚

### 升级流程

```bash
# 1. 备份当前版本
cp -r /opt/bilibili-monitor /opt/bilibili-monitor.backup.$(date +%Y%m%d)

# 2. 停止服务
sudo systemctl stop bilibili-monitor.timer  # 如果使用了Timer
sudo systemctl stop bilibili-monitor.service

# 3. 上传新版本
scp -r bilibili-monitor-v2.21.0/* user@server:/opt/bilibili-monitor/

# 4. 更新依赖（如有变化）
cd /opt/bilibili-monitor
source venv/bin/activate
pip install -r requirements.txt
deactivate

# 5. 重启服务
sudo systemctl restart bilibili-monitor.service

# 6. 验证升级
sudo journalctl -u bilibili-monitor --since "1 minute ago"
```

### 回滚流程

```bash
# 1. 停止服务
sudo systemctl stop bilibili-monitor.service

# 2. 恢复备份
rm -rf /opt/bilibili-monitor
cp -r /opt/bilibili-monitor.backup.YYYYMMDD /opt/bilibili-monitor

# 3. 重启服务
sudo systemctl start bilibili-monitor.service
```

---

## 📝 故障排查速查表

| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 服务无法启动 | Python依赖缺失 | 检查 `journalctl -u bilibili-monitor`，重新 `pip install -r requirements.txt` |
| 采集超时 | 网络慢或B站风控 | 检查网络连接，增加延迟配置 |
| 数据库锁定 | 并发写入冲突 | 确保只有一个实例在运行：`ps aux \| grep collect.py` |
| 权限错误 | 文件归属不正确 | `chown -R www-data:www-data /opt/bilibili-monitor` |
| 定时任务未执行 | Timer未启用 | `systemctl enable bilibili-monitor.timer && systemctl start bilibili-monitor.timer` |
| 内存占用过高 | 单次采集数据量大 | 调整 MemoryMax 限制，或分批采集 |

---

## 📞 技术支持

如遇到问题，请按顺序排查：

1. **查看日志**：`journalctl -u bilibili-monitor -f`
2. **阅读文档**：`docs/AUTOMATION_GUIDE.md`
3. **手动测试**：`cd /opt/bilibili-monitor/scripts && python collect.py`
4. **检查依赖**：`python -c "import better_sqlite3; from bilibili_api import user"`
5. **查看发版记录**：`RELEASE_NOTES.md` 了解已知问题

---

**最后更新**: 2026-05-08
**适用版本**: v2.20.0+
**维护者**: AI Assistant
