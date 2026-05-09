#!/bin/bash
# ============================================================
# B站竞品监控系统 - Linux服务器一键部署脚本
# ============================================================
# 适用环境：Ubuntu 22.04+ / Debian 12+ / CentOS 8+
# 用途：自动化完成项目部署、依赖安装、定时任务配置
#
# 使用方法：
#   chmod +x deploy-to-server.sh
#   ./deploy-to-server.sh
#
# 作者：AI Assistant
# 版本：v1.0.0 (2026-05-08)
# ============================================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置变量（可根据实际情况修改）
PROJECT_NAME="bilibili-monitor"
INSTALL_DIR="/opt/${PROJECT_NAME}"
SERVICE_USER="www-data"
PYTHON_VERSION="python3"

echo "============================================================"
echo "  B站竞品监控系统 - Linux服务器部署脚本"
echo "  版本: v2.20.0"
echo "  部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    log_error "请使用root用户运行此脚本（sudo ./deploy-to-server.sh）"
    exit 1
fi

log_info "开始部署 ${PROJECT_NAME}..."

# ========================================
# 步骤1：检查系统环境
# ========================================
log_info "步骤1/8: 检查系统环境..."

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$NAME
    OS_VERSION=$VERSION_ID
    log_info "操作系统: $OS_NAME $OS_VERSION"
else
    log_error "无法检测操作系统版本"
    exit 1
fi

# 检查Python3
if command -v $PYTHON_VERSION &> /dev/null; then
    PYTHON_VER=$($PYTHON_VERSION --version | awk '{print $2}')
    log_info "Python版本: $PYTHON_VER"
else
    log_error "Python3未安装，请先安装: apt install python3 python3-pip python3-venv"
    exit 1
fi

# 检查systemd
if systemctl --version &> /dev/null; then
    log_info "Systemd: 已安装 ($(systemd --version | head -1))"
else
    log_error "Systemd未安装，此脚本需要Systemd支持"
    exit 1
fi

log_success "系统环境检查通过"

# ========================================
# 步骤2：创建专用用户（如不存在）
# ========================================
log_info "步骤2/8: 创建服务用户..."

if id "$SERVICE_USER" &>/dev/null; then
    log_warn "用户 $SERVICE_USER 已存在，跳过创建"
else
    useradd -r -s /bin/false $SERVICE_USER
    log_success "已创建服务用户: $SERVICE_USER"
fi

# ========================================
# 步骤3：创建目录结构
# ========================================
log_info "步骤3/8: 创建目录结构..."

mkdir -p ${INSTALL_DIR}
mkdir -p ${INSTALL_DIR}/logs
mkdir -p ${INSTALL_DIR}/scripts/logs
mkdir -p ${INSTALL_DIR}/venv

log_success "目录结构已创建: ${INSTALL_DIR}"

# ========================================
# 步骤4：复制项目文件
# ========================================
log_info "步骤4/8: 复制项目文件..."

# 假设脚本在项目根目录执行，或者从当前目录复制
if [ -d "./bilibili-monitor" ]; then
    cp -r ./bilibili-monitor/* ${INSTALL_DIR}/
elif [ -f "./scripts/collect.py" ]; then
    # 当前就在scripts目录或项目根目录
    cp -r ./* ${INSTALL_DIR}/
else
    log_warn "未找到项目文件，请手动将项目文件复制到 ${INSTALL_DIR}"
    log_info "提示: 运行 'cp -r /path/to/bilibili-monitor/* ${INSTALL_DIR}/'"
fi

# 设置权限
chown -R ${SERVICE_USER}:${SERVICE_USER} ${INSTALL_DIR}
chmod 750 ${INSTALL_DIR}
chmod 640 ${INSTALL_DIR}/*.db 2>/dev/null || true  # 数据库文件权限更严格

log_success "项目文件已复制并设置权限"

# ========================================
# 步骤5：创建Python虚拟环境
# ========================================
log_info "步骤5/8: 创建Python虚拟环境..."

cd ${INSTALL_DIR}

if [ ! -d "venv" ] || [ ! -f "venv/bin/activate" ]; then
    $PYTHON_VERSION -m venv venv
    log_success "虚拟环境已创建"
else
    log_warn "虚拟环境已存在，跳过创建"
fi

# 安装依赖
log_info "安装Python依赖..."
source venv/bin/activate

if [ -f "requirements.txt" ]; then
    pip install --upgrade pip > /dev/null 2>&1
    pip install -r requirements.txt
    log_success "依赖安装完成"
elif [ -f "package.json" ]; then
    # Next.js项目的Node.js依赖（如果前端也需要部署）
    log_warn "检测到Next.js项目，可能还需要npm install"
else
    log_warn "未找到requirements.txt，跳过依赖安装"
fi

deactivate

# ========================================
# 步骤6：配置Systemd服务
# ========================================
log_info "步骤6/8: 配置Systemd定时任务服务..."

# 复制service文件
cp scripts/bilibili-monitor.service /etc/systemd/system/

# 根据实际路径修改service文件中的路径
sed -i "s|/opt/bilibili-monitor|${INSTALL_DIR}|g" /etc/systemd/system/bilibili-monitor.service

# 重载systemd配置
systemctl daemon-reload

# 启用开机自启（服务单元）
systemctl enable bilibili-monitor.service

# 配置定时器（Timer）- 关键！没有Timer不会自动执行
if [ -f "scripts/bilibili-monitor.timer" ]; then
    log_info "安装 Systemd Timer（定时触发器）..."
    cp scripts/bilibili-monitor.timer /etc/systemd/system/

    # 根据实际路径修改timer文件中的路径（如果需要）
    sed -i "s|/opt/bilibili-monitor|${INSTALL_DIR}|g" /etc/systemd/system/bilibili-monitor.timer

    # 重载systemd配置
    systemctl daemon-reload

    # 启用并启动Timer（这才是真正的定时任务！）
    systemctl enable bilibili-monitor.timer
    systemctl start bilibili-monitor.timer

    log_success "Systemd Timer 已启用 - 每天凌晨 00:05 自动执行"
else
    log_warn "未找到 bilibili-monitor.timer 文件，跳过定时任务配置"
    log_warn "请手动创建 Timer 文件或使用 crontab 方式"
fi

log_success "Systemd服务和定时器已配置完成"

# ========================================
# 步骤7：配置日志轮转
# ========================================
log_info "步骤7/9: 配置日志轮转..."

cat > /etc/logrotate.d/bilibili-monitor << EOF
${INSTALL_DIR}/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ${SERVICE_USER} ${SERVICE_USER}
    postrotate
        systemctl reload bilibili-monitor.service > /dev/null 2>&1 || true
    endscript
}
EOF

log_success "日志轮转已配置（保留30天）"

# ========================================
# 步骤8：验证部署
# ========================================
log_info "步骤8/9: 验证部署..."

echo ""

# 显示服务状态
log_info "服务状态:"
systemctl status bilibili-monitor.service --no-pager -l || true

echo ""

# 测试采集脚本能否正常运行
log_info "测试采集脚本语法..."
cd ${INSTALL_DIR}
source venv/bin/activate
$PYTHON_VERSION -c "
import sys
sys.path.insert(0, 'scripts')
try:
    import collect
    print('✅ collect.py 导入成功')
except Exception as e:
    print(f'❌ 导入失败: {e}')
    sys.exit(1)
" || {
    log_error "采集脚本验证失败！"
    deactivate
    exit 1
}

deactivate

echo ""
echo "============================================================"
log_success "🎉 部署完成！"
echo "============================================================"
echo ""
echo "📋 后续操作:"
echo ""
echo "  ⏰ 定时任务相关（重要！）:"
echo "      查看Timer状态:   sudo systemctl status bilibili-monitor.timer"
echo "      查看下次执行时间: sudo systemctl list-timers bilibili-monitor.timer"
echo "      禁用定时任务:    sudo systemctl stop bilibili-monitor.timer"
echo ""
echo "  1️⃣  手动触发一次采集（测试）:"
echo "      sudo systemctl start bilibili-monitor.service"
echo ""
echo "  2️⃣  查看实时日志:"
echo "      sudo journalctl -u bilibili-monitor -f"
echo ""
echo "  3️⃣  查看服务状态:"
echo "      sudo systemctl status bilibili-monitor.service"
echo ""
echo "  4️⃣  停止服务:"
echo "      sudo systemctl stop bilibili-monitor.service"
echo ""
echo "  5️⃣  Web界面访问（如果已部署Next.js）:"
echo "      http://YOUR_SERVER_IP:3000"
echo ""
echo "📚 文档位置:"
echo "  - 自动化指南: ${INSTALL_DIR}/docs/AUTOMATION_GUIDE.md"
echo "  - 发版记录: ${INSTALL_DIR}/RELEASE_NOTES.md"
echo "  - 日志文件: ${INSTALL_DIR}/logs/"
echo ""
echo "⚠️  注意事项:"
echo "  - 首次运行建议手动触发一次，确认无报错"
echo "  - ✅ 定时任务默认每天凌晨00:05自动执行（由Timer控制）"
echo "  - ⚠️  如果修改了执行时间，需要重启Timer: sudo systemctl restart bilibili-monitor.timer"
echo "  - 📝 Timer配置文件: /etc/systemd/system/bilibili-monitor.timer"
echo ""
echo "============================================================"
