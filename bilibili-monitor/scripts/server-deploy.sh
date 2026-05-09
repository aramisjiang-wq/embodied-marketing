#!/bin/bash
# ============================================================
# Embodied Marketing - 服务器端一键部署脚本
# ============================================================
# 用途：独立部署，不影响服务器上其他产品
# 端口：3001（可通过环境变量自定义）
#
# 使用方法：
#   chmod +x server-deploy.sh
#   ./server-deploy.sh
#
# 作者：AI Assistant
# 版本：v1.0.0 (2026-05-09)
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ========================================
# 配置变量（可根据实际情况修改）
# ========================================
PROJECT_NAME="embodied-marketing"
INSTALL_DIR="/opt/${PROJECT_NAME}"
PORT="${PORT:-3001}"
DOMAIN="${DOMAIN:-}"  # 如果有域名，例如: monitor.example.com

echo "============================================================"
echo "  Embodied Marketing - 服务器独立部署脚本"
echo "  部署目录: ${INSTALL_DIR}"
echo "  服务端口: ${PORT}"
echo "  域名: ${DOMAIN:-未设置（直接使用 IP:端口访问）}"
echo "  部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    log_error "请使用root用户运行此脚本（sudo ./server-deploy.sh）"
    exit 1
fi

# ========================================
# 步骤1：检查系统环境
# ========================================
log_info "步骤1/7: 检查系统环境..."

if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    log_info "Node.js版本: ${NODE_VER}"
else
    log_error "Node.js未安装，请先安装: curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VER=$(npm --version)
    log_info "NPM版本: ${NPM_VER}"
else
    log_error "NPM未安装"
    exit 1
fi

if command -v python3 &> /dev/null; then
    PYTHON_VER=$(python3 --version | awk '{print $2}')
    log_info "Python版本: ${PYTHON_VER}"
else
    log_warn "Python3未安装，数据采集功能将不可用"
fi

if command -v nginx &> /dev/null; then
    log_info "Nginx: 已安装"
else
    log_warn "Nginx未安装，将使用端口直接访问"
fi

log_success "系统环境检查通过"

# ========================================
# 步骤2：创建目录结构
# ========================================
log_info "步骤2/7: 创建目录结构..."

mkdir -p ${INSTALL_DIR}
mkdir -p ${INSTALL_DIR}/logs
mkdir -p ${INSTALL_DIR}/scripts/logs

log_success "目录结构已创建: ${INSTALL_DIR}"

# ========================================
# 步骤3：检查项目文件
# ========================================
log_info "步骤3/7: 检查项目文件..."

if [ ! -f "${INSTALL_DIR}/package.json" ]; then
    log_error "未找到 package.json！请先运行 GitHub Actions 部署或手动复制项目文件"
    log_info "提示: 项目文件应该位于 ${INSTALL_DIR}/ 目录下"
    exit 1
fi

log_success "项目文件检查通过"

# ========================================
# 步骤4：安装依赖并构建
# ========================================
log_info "步骤4/7: 安装依赖并构建..."

cd ${INSTALL_DIR}

log_info "安装 Node.js 依赖..."
npm install --production=false

log_info "构建 Next.js 应用..."
npm run build

# Python 环境（可选）
if command -v python3 &> /dev/null; then
    log_info "配置 Python 虚拟环境..."
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        log_success "虚拟环境已创建"
    fi

    source venv/bin/activate
    pip install --upgrade pip > /dev/null 2>&1

    if [ -f "scripts/requirements.txt" ]; then
        pip install -r scripts/requirements.txt || log_warn "Python 依赖安装失败（非必需）"
    else
        log_warn "未找到 requirements.txt"
    fi
    deactivate
fi

log_success "依赖安装和构建完成"

# ========================================
# 步骤5：配置 Systemd 服务
# ========================================
log_info "步骤5/7: 配置 Systemd 服务..."

cat > /etc/systemd/system/${PROJECT_NAME}.service << EOF
[Unit]
Description=Embodied Marketing - Next.js Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/npm run start -- -p ${PORT}
Restart=always
RestartSec=10
StandardOutput=append:${INSTALL_DIR}/logs/server.log
StandardError=append:${INSTALL_DIR}/logs/server.log
Environment=NODE_ENV=production
Environment=PORT=${PORT}

[Install]
WantedBy=multi-user.target
EOF

log_success "Systemd 服务文件已创建: /etc/systemd/system/${PROJECT_NAME}.service"

systemctl daemon-reload
systemctl enable ${PROJECT_NAME}.service

# ========================================
# 步骤6：配置 Nginx（可选）
# ========================================
log_info "步骤6/7: 配置 Nginx..."

if [ -n "${DOMAIN}" ] && command -v nginx &> /dev/null; then
    cat > /etc/nginx/sites-available/${PROJECT_NAME} << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # 飞书回调超时设置（重要！）
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/${PROJECT_NAME} /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    log_success "Nginx 已配置: http://${DOMAIN}"
elif command -v nginx &> /dev/null; then
    log_warn "未设置域名，跳过 Nginx 配置"
    log_info "可直接通过端口访问: http://$(curl -s ifconfig.me):${PORT}"
else
    log_warn "Nginx 未安装，跳过配置"
fi

# ========================================
# 步骤7：启动服务并验证
# ========================================
log_info "步骤7/7: 启动服务并验证..."

# 停止可能存在的旧进程
pkill -f "next start.*port=${PORT}" 2>/dev/null || true
sleep 2

# 启动服务
systemctl start ${PROJECT_NAME}.service
sleep 5

# 验证
if systemctl is-active --quiet ${PROJECT_NAME}.service; then
    log_success "✅ 服务启动成功！"
else
    log_error "❌ 服务启动失败，查看日志:"
    journalctl -u ${PROJECT_NAME}.service -n 50 --no-pager
    exit 1
fi

echo ""
echo "============================================================"
log_success "🎉 部署完成！"
echo "============================================================"
echo ""
echo "📋 访问信息:"
echo ""

if [ -n "${DOMAIN}" ]; then
    echo "  🌐 Web应用:     http://${DOMAIN}"
    echo "  🔗 飞书回调地址: http://${DOMAIN}/api/auth/callback"
else
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    echo "  🌐 Web应用:     http://${SERVER_IP}:${PORT}"
    echo "  🔗 飞书回调地址: http://${SERVER_IP}:${PORT}/api/auth/callback"
fi

echo ""
echo "⚙️ 服务管理命令:"
echo "  查看状态:   systemctl status ${PROJECT_NAME}.service"
echo "  查看日志:   journalctl -u ${PROJECT_NAME}.service -f"
echo "  重启服务:   systemctl restart ${PROJECT_NAME}.service"
echo "  停止服务:   systemctl stop ${PROJECT_NAME}.service"
echo ""
echo "📂 重要路径:"
echo "  项目目录:   ${INSTALL_DIR}"
echo "  日志文件:   ${INSTALL_DIR}/logs/server.log"
echo "  配置文件:   /etc/systemd/system/${PROJECT_NAME}.service"
echo ""
echo "⚠️ 后续配置（重要！）:"
echo ""
echo "  1️⃣  设置环境变量（创建 .env.local 文件）:"
echo "      cd ${INSTALL_DIR}"
echo "      cat > .env.local << 'ENVEOF'"
echo "      FEISHU_APPID=你的飞书AppID"
echo "      FEISHU_APP_SECRET=你的飞书AppSecret"
echo "      NEXT_PUBLIC_BASE_URL=http://${SERVER_IP:-YOUR_DOMAIN}:${PORT}"
echo "      ENVEOF"
echo ""
echo "  2️⃣  在飞书开放平台配置重定向URL:"
echo "      将下面的地址添加到飞书应用的安全设置中:"
if [ -n "${DOMAIN}" ]; then
    echo "      http://${DOMAIN}/api/auth/callback"
else
    echo "      http://${SERVER_IP}:${PORT}/api/auth/callback"
fi
echo ""
echo "  3️⃣  创建管理员用户（首次登录前）:"
echo "      参考 docs/AUTOMATION_GUIDE.md 或手动插入数据库"
echo ""
echo "============================================================"