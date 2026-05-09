#!/bin/bash
# ============================================================
# 飞书凭证快速配置脚本
# 用途: 快速填入飞书 AppID 和 AppSecret 并重启服务
#
# 使用方法:
#   chmod +x setup-feishu-creds.sh
#   ./setup-feishu-creds.sh
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

echo "============================================================"
echo "  飞书凭证配置工具 - Embodied Marketing"
echo "  服务器: 101.200.222.139"
echo "  项目目录: /opt/embodied-marketing"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    log_error "请使用 root 用户运行此脚本"
    exit 1
fi

cd /opt/embodied-marketing

# 备份当前配置
BACKUP_FILE=".env.local.backup.$(date +%Y%m%d%H%M%S)"
cp .env.local "$BACKUP_FILE" 2>/dev/null || true
log_info "已备份当前配置到: $BACKUP_FILE"

echo ""
log_info "请输入飞书应用凭证（从 https://open.feishu.cn/app 获取）:"
echo ""

# 输入 AppID
read -p "请输入 App ID (格式: cli_xxxxxxxxxx): " APP_ID

# 验证 AppID 格式
if [[ ! "$APP_ID" =~ ^cli_ ]]; then
    log_error "AppID 格式不正确！应该以 'cli_' 开头"
    exit 1
fi

# 输入 AppSecret
read -p "请输入 App Secret: " APP_SECRET

if [ -z "$APP_SECRET" ]; then
    log_error "AppSecret 不能为空"
    exit 1
fi

echo ""
log_info "正在写入配置文件..."

# 写入新的环境变量
cat > .env.local << EOF
# Emboded Marketing 环境变量配置
# 配置时间: $(date '+%Y-%m-%d %H:%M:%S')

# 应用基础URL
NEXT_PUBLIC_BASE_URL=http://101.200.222.139:8082

# Node.js 环境
NODE_ENV=production

# 飞书应用凭证
FEISHU_APPID=${APP_ID}
FEISHU_APP_SECRET=${APP_SECRET}
EOF

# 设置权限（仅root可读）
chmod 600 .env.local

log_success "环境变量已写入"

echo ""
log_info "验证配置内容..."
grep "^FEISHU_" .env.local | sed 's/=.*/=***/'

echo ""
log_info "正在重启 PM2 服务..."

# 重启服务
pm2 restart embodied-marketing

# 等待启动
sleep 5

# 检查状态
echo ""
pm2 list | grep embodied

echo ""
log_info "验证 API 返回的凭证..."

# 测试API
AUTH_URL=$(curl -s http://127.0.0.1:8082/api/auth/feishu | grep -o "client_id=[^&]*")

if echo "$AUTH_URL" | grep -q "cli_"; then
    log_success "✅ 飞书凭证配置成功！"
    echo ""
    echo "  API 返回的 client_id: $AUTH_URL"
    echo ""
    echo "  现在可以打开浏览器测试登录了:"
    echo "  http://101.200.222.139:8082/login"
else
    log_error "❌ 凭证可能未生效，请检查日志:"
    pm2 logs embodied-marketing --err --lines 20 --nostream
    exit 1
fi

echo ""
echo "============================================================"
log_success "🎉 配置完成！"
echo "============================================================"
echo ""
echo "📍 下一步操作:"
echo "  1. 打开浏览器访问: http://101.200.222.139:8082/login"
echo "  2. 二维码应该正常显示（不再转圈）"
echo "  3. 使用飞书 App 扫码登录"
echo "  4. 授权后自动跳转到仪表板"
echo ""
echo "📋 常用命令:"
echo "  查看状态: pm2 list"
echo "  查看日志: pm2 logs embodied-marketing"
echo "  重启服务: pm2 restart embodied-marketing"
echo ""
echo "💾 备份位置: ${BACKUP_FILE}"
echo "  如需回滚: cp ${BACKUP_FILE} .env.local && pm2 restart embodied-marketing"
echo "============================================================"
