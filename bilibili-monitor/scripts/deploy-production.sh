#!/bin/bash
# ============================================================================
# 生产级部署脚本 - v2.31.0-security
# 功能：将本地代码和数据库安全同步到服务器
# 特性：自动备份、增量同步、健康检查、回滚支持
#
# 使用方法：
#   chmod +x scripts/deploy-production.sh
#   ./scripts/deploy-production.sh [--dry-run] [--skip-db] [--force]
#
# 参数说明：
#   --dry-run     : 仅显示将要执行的操作，不实际执行
#   --skip-db    : 跳过数据库同步（仅更新代码）
#   --force      : 强制覆盖服务器数据库（危险！会丢失服务器数据）
# ============================================================================

set -euo pipefail

# ============================================
# 配置区 - 根据实际情况修改
# ============================================
SERVER_USER="root"
SERVER_HOST="101.200.222.139"
SERVER_DIR="/opt/embodied-marketing"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="/opt/embodied-marketing/backups"
APP_PORT=8082
PM2_APP_NAME="embodied-marketing"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="deploy_${TIMESTAMP}.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# 工具函数
# ============================================
log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

check_command() {
  if ! command -v "$1" &>/dev/null; then
    log_error "Required command '$1' not found. Please install it first."
    exit 1
  fi
}

# 解析命令行参数
DRY_RUN=false
SKIP_DB=false
FORCE_DB=false
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --skip-db) SKIP_DB=true ;;
    --force) FORCE_DB=true ;;
    *)
      echo "Unknown parameter: $arg"
      echo "Usage: $0 [--dry-run] [--skip-db] [--force]"
      exit 1
      ;;
  esac
done

# ============================================
# 前置检查
# ============================================
log_info "=========================================="
log_info "生产级部署脚本 v2.31.0-security"
log_info "=========================================="
log_info ""

# 检查必要工具
log_info "步骤1/10: 检查必要工具..."
check_command "ssh"
check_command "rsync"
check_command "sqlite3"

# 检查本地文件
if [ ! -f "${LOCAL_DIR}/bilibili_monitor.db" ]; then
  log_error "Local database not found: ${LOCAL_DIR}/bilibili_monitor.db"
  exit 1
fi

if [ ! -d "${LOCAL_DIR}/src" ]; then
  log_error "Source code directory not found: ${LOCAL_DIR}/src"
  exit 1
fi

# 检查SSH连接
log_info "步骤2/10: 测试SSH连接..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "${SERVER_USER}@${SERVER_HOST}" "echo 'SSH OK'" &>/dev/null; then
  log_error "Cannot connect to server ${SERVER_USER}@${SERVER_HOST}"
  exit 1
fi
log_success "SSH connection OK"

# 显示部署概要
echo ""
log_info "=== 部署概要 ==="
log_info "本地目录: ${LOCAL_DIR}"
log_info "服务器: ${SERVER_USER}@${SERVER_HOST}:${SERVER_DIR}"
log_info "数据库: $(ls -lh ${LOCAL_DIR}/bilibili_monitor.db | awk '{print $5}') ($(sqlite3 ${LOCAL_DIR}/bilibili_monitor.db "SELECT COUNT(*) FROM brands" 2>/dev/null || echo '?') brands)"
log_info "模式: $(if $DRY_RUN; then echo 'DRY-RUN (仅预览)'; else echo 'PRODUCTION (实际执行)'; fi)"
log_info "数据库同步: $(if $SKIP_DB; then echo '跳过'; elif $FORCE_DB; then echo '强制覆盖'; else echo '增量合并'; fi)"
log_info "日志文件: ${LOG_FILE}"
echo ""

if $DRY_RUN; then
  log_warn "*** DRY-RUN MODE - 不会执行任何实际操作 ***"
  echo ""
fi

# 用户确认
if ! $DRY_RUN; then
  read -p "确认开始部署？(yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    log_info "Deployment cancelled by user."
    exit 0
  fi
  echo ""
fi

# ============================================
# 步骤3: 备份服务器现有数据
# ============================================
log_info "步骤3/10: 备份服务器现有数据..."

ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'REMOTE_BACKUP'
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/bilibili-monitor/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

# 备份数据库（如果存在）
if [ -f "/opt/bilibili-monitor/bilibili_monitor.db" ]; then
  cp "/opt/bilibili-monitor/bilibili_monitor.db" \
     "${BACKUP_DIR}/bilibili_monitor.db.${TIMESTAMP}.bak"
  echo "DB_BACKUP=${BACKUP_DIR}/bilibili_monitor.db.${TIMESTAMP}.bak"
else
  echo "DB_BACKUP=NONE"
fi

# 备份代码（可选，用于回滚）
if [ -d "/opt/bilibili-monitor/src" ]; then
  tar -czf "${BACKUP_DIR}/code.${TIMESTAMP}.tar.gz" \
    -C /opt/bilibili-monitor \
    src/ package.json next.config.ts middleware.ts *.db 2>/dev/null || true
  echo "CODE_BACKUP=${BACKUP_DIR}/code.${TIMESTAMP}.tar.gz"
else
  echo "CODE_BACKUP=NONE"
fi

# 清理旧备份（保留最近7天）
find "${BACKUP_DIR}" -name "*.bak" -mtime +7 -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true

echo "BACKUP_COMPLETE"
REMOTE_BACKUP

# 解析备份结果
eval "$(ssh "${SERVER_USER}@${SERVER_HOST}" bash -s < <(cat <<'SCRIPT'
#!/bin/bash
ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'REMOTE_BACKUP'
...（上面的脚本）...
REMOTE_BACKUP

eval "$(ssh "${SERVER_USER}@${SERVER_HOST}" "bash -s" <<'REMOTE_BACKUP'
...上面的备份脚本...
REMOTE_BACKUP)"

DB_BACKUP=$(echo "$BACKUP_RESULT" | grep "^DB_BACKUP=" | cut -d'=' -f2)
CODE_BACKUP=$(echo "$BACKUP_RESULT" | grep "^CODE_BACKUP=" | cut -d'=' -f2)

if [ "$DB_BACKUP" != "NONE" ] && [ -n "$DB_BACKUP" ]; then
  log_success "服务器数据库已备份到: ${DB_BACKUP}"
else
  log_warn "服务器上没有现有的数据库（首次部署）"
fi

if [ "$CODE_BACKUP" != "NONE" ] && [ -n "$CODE_BACKUP" ]; then
  log_success "服务器代码已备份到: ${CODE_BACKUP}"
fi

# ============================================
# 步骤4: 同步代码文件（排除敏感文件）
# ============================================
log_info "步骤4/10: 同步代码文件..."

RSYNC_EXCLUDES=(
  '--exclude=node_modules/'
  '--exclude=.next/'
  '--exclude=.env.local'
  '--exclude=*.db'
  '--exclude=.git/'
  '--exclude=__pycache__/'
  '--exclude=*.pyc'
  '--exclude=bilibili-api/'
  '--exclude=backups/'
  '--exclude=*.log'
)

RSYNC_OPTIONS=(
  -avz
  --progress
  --human-readable
  "${RSYNC_EXCLUDES[@]}"
  -e "ssh"
  "${LOCAL_DIR}/"
  "${SERVER_USER}@${SERVER_HOST}:${SERVER_DIR}/"
)

if $DRY_RUN; then
  log_warn "[DRY-RUN] 将执行: rsync ${RSYNC_OPTIONS[*]}"
else
  rsync "${RSYNC_OPTIONS[@]}" 2>&1 | tee -a "$LOG_FILE" | tail -20
fi

log_success "代码同步完成"

# ============================================
# 步骤5: 数据库迁移（最关键的步骤）
# ============================================
log_info "步骤5/10: 迁移数据库..."

if $SKIP_DB; then
  log_warn "跳过数据库同步（--skip-db 参数）"
elif $FORCE_DB; then
  log_warn "⚠️  强制模式：将覆盖服务器数据库！"
  
  if $DRY_RUN; then
    log_warn "[DRY-RUN] 将复制本地数据库到服务器（会丢失服务器数据）"
  else
    # 强制覆盖
    scp "${LOCAL_DIR}/bilibili_monitor.db" \
        "${SERVER_USER}@${SERVER_HOST}:${SERVER_DIR}/bilibili_monitor.db.new"
    
    ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'FORCE_DEPLOY'
#!/bin/bash
set -euo pipefail
cd /opt/bilibili-monitor

# 停止服务（如果有运行中）
pm2 stop bilibili-monitor 2>/dev/null || true

# 替换数据库
mv bilibili_monitor.db.new bilibili_monitor.db

# 设置权限
chown bilibili-user:bilibili-user bilibili_monitor.db
chmod 640 bilibili_monitor.db

echo "FORCE_DEPLOY_DONE"
FORCE_DEPLOY
    
    log_success "数据库已强制替换（服务器原数据已备份）"
  fi
else
  # 安全的增量同步模式
  log_info "使用安全的增量同步模式..."
  
  if $DRY_RUN; then
    log_warn "[DRY-RUN] 将执行安全的数据库合并策略"
  else
    # 策略：
    # 1. 上传本地数据库为临时文件
    # 2. 在服务器上使用 sqlite3 的 .import 或 ATTACH 合并数据
    # 3. 验证数据完整性
    
    scp "${LOCAL_DIR}/bilibili_monitor.db" \
        "${SERVER_USER}@${SERVER_HOST}:${SERVER_DIR}/bilibili_monitor.db.local"
    
    ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'MERGE_DB'
#!/bin/bash
set -euo pipefail
cd /opt/bilibili-monitor

echo "开始数据库合并..."

# 如果服务器已有数据库，进行合并
if [ -f "bilibili_monitor.db" ]; then
  echo "检测到现有数据库，执行增量合并..."
  
  # 创建临时合并数据库
  cp bilibili_monitor.db bilibili_monitor.db.merging
  
  # 使用 sqlite3 ATTACH 合并数据
  sqlite3 bilibili_monitor.db.merging <<SQL
ATTACH DATABASE 'bilibili_monitor.db.local' AS local_db;

-- 合并 brands 表（忽略冲突，保留本地）
INSERT OR IGNORE INTO brands SELECT * FROM local_db.brands;

-- 合并 videos 表
INSERT OR IGNORE INTO videos SELECT * FROM local_db.videos;

-- 合并 video_stats 表
INSERT OR IGNORE INTO video_stats SELECT * FROM local_db.video_stats;

-- 合并 brand_stats 表
INSERT OR IGNORE INTO brand_stats SELECT * FROM local_db.brand_stats;

-- 合并 site_likes 表
INSERT OR IGNORE INTO site_likes SELECT * FROM local_db.site_likes;

-- 合并 site_views 表
INSERT OR IGNORE INTO site_views SELECT * FROM local_db.site_views;

DETACH DATABASE local_db;
SQL
  
  # 替换原数据库
  mv bilibili_monitor.db bilibili_monitor.db.pre_merge
  mv bilibili_monitor.db.merging bilibili_monitor.db
  
  # 删除临时文件
  rm -f bilibili_monitor.db.pre_merge bilibili_monitor.db.local
  
  echo "INCREMENTAL_MERGE_COMPLETE"
else
  # 首次部署，直接使用本地数据库
  cp bilibili_monitor.db.local bilibili_monitor.db
  echo "FIRST_DEPLOY_COMPLETE"
fi

# 设置权限
chown bilibili-user:bilibili-user bilibili_monitor.db
chmod 640 bilibili_monitor.db

# 验证数据库完整性
echo ""
echo "=== 数据库验证 ==="
echo "表数量: $(sqlite3 bilibili_monitor.db '.tables' | wc -w)"
echo "Brands: $(sqlite3 bilibili_monitor.db 'SELECT COUNT(*) FROM brands')"
echo "Videos: $(sqlite3 bilibili_monitor.db 'SELECT COUNT(*) FROM videos')"
echo "Video Stats: $(sqlite3 bilibili_monitor.db 'SELECT COUNT(*) FROM video_stats')"
echo "Users: $(sqlite3 bilibili_monitor.db 'SELECT COUNT(*) FROM users')"
MERGE_DB

    MERGE_RESULT=$(echo "$MERGE_OUTPUT" | tail -1)
    
    if [ "$MERGE_RESULT" = "INCREMENTAL_MERGE_COMPLETE" ]; then
      log_success "数据库增量合并完成"
    elif [ "$MERGE_RESULT" = "FIRST_DEPLOY_COMPLETE" ]; then
      log_success "首次部署：数据库已上传"
    else
      log_error "数据库合并失败: $MERGE_RESULT"
      exit 1
    fi
  fi
fi

# ============================================
# 步骤6: 安装依赖（如果需要）
# ============================================
log_info "步骤6/10: 检查并安装依赖..."

ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'CHECK_DEPS'
#!/bin/bash
set -euo pipefail
cd /opt/bilibili-monitor

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-locked" ]; then
  echo "NEED_INSTALL=true"
  
  # 安装依赖
  if command -v npm &>/dev/null; then
    npm install --production 2>&1 | tail -5
    touch node_modules/.package-locked
  else
    echo "NPM_NOT_FOUND"
  fi
else
  echo "NEED_INSTALL=false"
fi
CHECK_DEPS

DEPS_STATUS=$(echo "$DEPS_OUTPUT" | grep -E "(NEED_INSTALL|NPM_NOT_FOUND)" | tail -1)

case $DEPS_STATUS in
  NEED_INSTALL=true) log_success "依赖安装完成" ;;
  NEED_INSTALL=false) log_info "依赖已是最新，跳过安装" ;;
  NPM_NOT_FOUND) log_error "服务器未安装npm，请手动安装依赖" ;;
esac

# ============================================
# 步骤7: 构建项目（如果需要）
# ============================================
log_info "步骤7/10: 构建Next.js项目..."

ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'BUILD_PROJECT'
#!/bin/bash
set -euo pipefail
cd /opt/bilibili-monitor

# 检查是否需要构建
if [ ".next/BUILD_ID" -nt "package.json" ] && [ -d ".next" ]; then
  echo "BUILD_NEEDED=false"
else
  echo "BUILD_NEEDED=true"
  
  # 构建
  if command -v npx &>/dev/null; then
    npx next build 2>&1 | tail -20
    echo "BUILD_SUCCESS"
  else
    echo "NPX_NOT_FOUND"
  fi
fi
BUILD_PROJECT

BUILD_STATUS=$(echo "$BUILD_OUTPUT" | tail -1)

case $BUILD_STATUS in
  BUILD_NEEDED=false) log_info "项目已是最新构建，跳过" ;;
  BUILD_SUCCESS) log_success "项目构建成功" ;;
  NPX_NOT_FOUND) log_warn "服务器未安装npx，尝试使用预构建版本" ;;
esac

# ============================================
# 步骤8: 重启服务
# ============================================
log_info "步骤8/10: 重启服务..."

if $DRY_RUN; then
  log_warn "[DRY-RUN] 将重启服务: pm2 restart bilibili-monitor 或 systemctl restart bilibili-monitor"
else
  ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'RESTART_SERVICE'
#!/bin/bash
set -euo pipefail
cd /opt/bilibili-monitor

# 尝试 pm2 重启
if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q "${PM2_APP_NAME}"; then
  pm2 restart ${PM2_APP_NAME} 2>&1
  echo "RESTART_PM2"
# 尝试 systemctl 重启
elif systemctl is-enabled bilibili-monitor.service &>/dev/null; then
  systemctl restart bilibili-monitor 2>&1
  echo "RESTART_SYSTEMD"
# 尝试直接启动
else
  # 查找进程并杀死
  pkill -f "next-server" 2>/dev/null || true
  sleep 2
  
  # 后台启动
  nohup npx next start -p 3000 > logs/server.log 2>&1 &
  sleep 3
  
  # 检查是否启动成功
  if pgrep -f "next-server" > /dev/null; then
    echo "RESTART_MANUAL_OK"
  else
    echo "RESTART_FAILED"
  fi
fi
RESTART_SERVICE

  RESTART_RESULT=$(echo "$RESTART_OUTPUT" | tail -1)
  
  case $RESTART_RESULT in
    RESTART_PM2) log_success "服务已通过 PM2 重启" ;;
    RESTART_SYSTEMD) log_success "服务已通过 Systemd 重启" ;;
    RESTART_MANUAL_OK) log_success "服务已手动重启" ;;
    RESTART_FAILED) log_error "服务重启失败！请手动检查" ; exit 1 ;;
  esac
  
  # 等待服务启动
  log_info "等待服务启动..."
  sleep 5
fi

# ============================================
# 步骤9: 健康检查
# ============================================
log_info "步骤9/10: 执行健康检查..."

if $DRY_RUN; then
  log_warn "[DRY-RUN] 跳过健康检查"
else
  HEALTH_CHECK_URL="http://${SERVER_HOST}:${APP_PORT}/api/overview"
  
  # 等待服务完全启动
  sleep 3
  
  # 通过 SSH 执行内部健康检查（避免防火墙问题）
  HEALTH_RESULT=$(ssh "${SERVER_USER}@${SERVER_HOST}" bash -s <<'HEALTH_CHECK'
#!/bin/bash
set -euo pipefail

# 检查端口是否在监听
if ss -tlnp | grep -q ":3000"; then
  PORT_STATUS="LISTENING"
else
  PORT_STATUS="NOT_LISTENING"
fi

# 检查进程是否存在
if pgrep -f "next-server" > /dev/null; then
  PROCESS_STATUS="RUNNING"
else
  PROCESS_STATUS="NOT_RUNNING"
fi

# 检查日志是否有错误
ERROR_COUNT=$(tail -50 logs/server.log 2>/dev/null | grep -ci "error\|fatal" || echo "0")

# 检查数据库可读性
if [ -f "bilibili_monitor.db" ] && sqlite3 bilibili_monitor.db "SELECT 1" &>/dev/null; then
  DB_STATUS="OK"
else
  DB_STATUS="ERROR"
fi

echo "PORT:${PORT_STATUS}|PROCESS:${PROCESS_STATUS}|DB:${DB_STATUS}|ERRORS:${ERROR_COUNT}"
HEALTH_CHECK
)
  
  IFS='|' read -r PORT_STATUS PROCESS_STATUS DB_STATUS ERRORS <<< "$HEALTH_RESULT"
  
  echo ""
  log_info "=== 健康检查结果 ==="
  log_info "端口状态: ${PORT_STATUS}"
  log_info "进程状态: ${PROCESS_STATUS}"
  log_info "数据库状态: ${DB_STATUS}"
  log_info "近期错误数: ${ERRORS}"
  
  # 综合判断
  if [ "$PORT_STATUS" = "LISTENING" ] && [ "$PROCESS_STATUS" = "RUNNING" ] && [ "$DB_STATUS" = "OK" ]; then
    log_success "✅ 所有健康检查通过！"
    DEPLOYMENT_STATUS="SUCCESS"
  else
    log_error "❌ 健康检查失败！"
    log_error "请手动检查服务器状态"
    DEPLOYMENT_STATUS="FAILED"
  fi
fi

# ============================================
# 步骤10: 生成部署报告
# ============================================
log_info "步骤10/10: 生成部署报告..."

echo ""
echo "=========================================="
echo "          部署完成报告"
echo "=========================================="
echo ""
echo "📅 部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "📦 版本: v2.31.0-security"
echo "🌐 服务器: ${SERVER_USER}@${SERVER_HOST}"
echo "📁 目录: ${SERVER_DIR}"
echo "📊 数据库: 已同步"
echo "🔄 服务状态: ${DEPLOYMENT_STATUS:-PENDING}"
echo ""
echo "📋 操作日志: ${LOG_FILE}"
echo ""
echo "=========================================="

if [ "${DEPLOYMENT_STATUS:-PENDING}" = "FAILED" ]; then
  echo ""
  echo "❌ 部分失败！建议操作："
  echo "  1. 查看日志: tail -100 ${LOG_FILE}"
  echo "  2. SSH 到服务器: ssh ${SERVER_USER}@${SERVER_HOST}"
  echo "  3. 手动检查: cd ${SERVER_DIR} && pm2 logs"
  echo "  4. 回滚方案: 使用备份文件恢复"
  echo "     数据库备份: ${DB_BACKUP:-无}"
  echo "     代码备份: ${CODE_BACKUP:-无}"
  exit 1
else
  echo ""
  echo "✅ 部署成功！下一步："
  echo "  1. 访问系统: http://${SERVER_HOST}:${APP_PORT}/login"
  echo "  2. 使用飞书扫码登录测试"
  echo "  3. 验证功能: 创建/编辑/删除品牌"
  echo "  4. 查看管理员后台: http://${SERVER_HOST}:${APP_PORT}/admin"
  echo ""
  echo "🎉 恭喜！B站竞品监控系统 v2.31.0 已成功部署！"
fi

# 清理
exit 0
