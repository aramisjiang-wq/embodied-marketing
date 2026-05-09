#!/bin/bash
# B站竞品数据采集 - 每日定时任务脚本
# 运行时间: 每天 00:00 (零点)
# 用途: 自动采集所有品牌的最新数据

set -e

PROJECT_DIR="/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor"
LOG_DIR="$PROJECT_DIR/scripts/logs"
VENV_DIR="$PROJECT_DIR/venv"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 日志文件（按日期命名）
LOG_FILE="$LOG_DIR/cron_$(date +%Y%m%d_%H%M%S).log"

echo "========================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始执行每日数据采集" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# 激活虚拟环境并运行采集
cd "$PROJECT_DIR/scripts"

source "$VENV_DIR/bin/activate" && python collect.py >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 数据采集完成 (退出码: $EXIT_CODE)" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 数据采集失败 (退出码: $EXIT_CODE)" >> "$LOG_FILE"
fi

echo "========================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit $EXIT_CODE
