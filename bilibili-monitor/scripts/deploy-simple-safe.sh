#!/bin/bash
# 安全部署脚本 - 分步执行

SERVER="root@101.200.222.139"
PASSWORD="XLj4kUnh"
REMOTE_DIR="/opt/embodied-marketing"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=========================================="
echo "  Embodied Marketing - 安全部署脚本"
echo "=========================================="
echo ""

# 步骤 1: 打包
echo "📦 Step 1: 打包本地代码..."
cd "$LOCAL_DIR"
tar czf /tmp/embodied-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='*.db' \
    --exclude='*.db-shm' \
    --exclude='*.db-wal' \
    --exclude='.env.local' \
    --exclude='scripts/collect_status.json' \
    --exclude='scripts/logs' \
    .

echo "   ✅ 打包完成"

# 步骤 2: 上传
echo ""
echo "🚀 Step 2: 上传到服务器..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no /tmp/embodied-deploy.tar.gz $SERVER:/tmp/
echo "   ✅ 上传完成"

rm -f /tmp/embodied-deploy.tar.gz

# 步骤 3: 解压和部署
echo ""
echo "🔨 Step 3: 服务器端部署..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER << 'DEPLOY_SAFE'
set -e

cd /opt/embodied-marketing

echo "   [1/6] 停止服务..."
pm2 stop embodied-marketing 2>/dev/null || true
pm2 delete embodied-marketing 2>/dev/null || true

echo "   [2/6] 备份..."
mkdir -p /opt/embodied-marketing/backup
tar czf /opt/embodied-marketing/backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz --exclude='node_modules' --exclude='.next' --exclude='*.db' --exclude='.env.local' . 2>/dev/null || true

echo "   [3/6] 解压新代码..."
# 备份运行时状态文件（不被代码覆盖）
cp /opt/embodied-marketing/scripts/collect_status.json /tmp/collect_status.json.bak 2>/dev/null || true
rm -rf src public scripts docs next.config.ts package.json tsconfig.json tailwind.config.ts postcss.config.js components.json middleware.ts
tar xzf /tmp/embodied-deploy.tar.gz -C /opt/embodied-marketing
rm -f /tmp/embodied-deploy.tar.gz
# 还原运行时状态文件
[ -f /tmp/collect_status.json.bak ] && mv /tmp/collect_status.json.bak /opt/embodied-marketing/scripts/collect_status.json

echo "   [4/6] 清理构建产物..."
rm -rf .next

echo "   [5/6] 重新构建..."
npm install --production=false
npm run build

echo "   [6/6] 启动服务..."
pm2 start npm --name "embodied-marketing" -- start -p 8082
pm2 save

echo ""
echo "✅ 部署完成！"
pm2 status embodied-marketing

DEPLOY_SAFE

echo ""
echo "=========================================="
echo "  ✅ 部署完成！"
echo "=========================================="
echo ""
echo "请访问: http://101.200.222.139:8082/login"
