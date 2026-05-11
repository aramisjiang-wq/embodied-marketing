#!/bin/bash
# 自动部署脚本 - 使用密码认证
set -e

SERVER="root@101.200.222.139"
PASSWORD="XLj4kUnh"
# 注意：根据运维记录，真实运行目录是 /opt/embodied-marketing
REMOTE_DIR="/opt/embodied-marketing"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=========================================="
echo "  Embodied Marketing - 自动部署脚本"
echo "=========================================="
echo "📁 本地目录: $LOCAL_DIR"
echo "🖥️  远程服务器: $SERVER:$REMOTE_DIR"
echo ""

echo "📦 Step 1: 打包本地代码（排除 node_modules, .next, .git）..."
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

if [ $? -eq 0 ]; then
    echo "   ✅ 打包完成: $(du -h /tmp/embodied-deploy.tar.gz | cut -f1)"
else
    echo "   ❌ 打包失败"
    exit 1
fi

echo ""
echo "🚀 Step 2: 上传到服务器并解压..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no /tmp/embodied-deploy.tar.gz $SERVER:/tmp/

if [ $? -eq 0 ]; then
    echo "   ✅ 上传成功"
else
    echo "   ❌ 上传失败"
    rm -f /tmp/embodied-deploy.tar.gz
    exit 1
fi

rm -f /tmp/embodied-deploy.tar.gz

echo ""
echo "🔨 Step 3: 在服务器上解压并部署..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER << 'DEPLOY_EOF'
set -e
cd /opt/embodied-marketing

echo "停止当前服务..."
pm2 stop embodied-marketing 2>/dev/null || true
pm2 delete embodied-marketing 2>/dev/null || true

echo "备份当前代码..."
mkdir -p /opt/embodied-marketing/backup
tar czf /opt/embodied-marketing/backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz --exclude='node_modules' --exclude='.next' --exclude='*.db' --exclude='.env.local' . || true

echo "解压新代码..."
cd /opt/embodied-marketing
rm -rf src public scripts docs next.config.ts package.json tsconfig.json tailwind.config.ts postcss.config.js components.json middleware.ts
tar xzf /tmp/embodied-deploy.tar.gz -C /opt/embodied-marketing
rm -f /tmp/embodied-deploy.tar.gz

echo "清理旧的构建产物..."
rm -rf .next

echo "检查 Node.js 版本..."
node --version

echo "安装依赖..."
npm install --production=false 2>&1 | tail -10

echo "构建项目..."
npm run build 2>&1 | tail -30

echo "启动服务..."
pm2 start npm --name "embodied-marketing" -- start -- -p 8082
pm2 save

echo ""
echo "✅ 服务已启动！"
echo "状态:"
pm2 status embodied-marketing
DEPLOY_EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  ✅ 部署完成！"
    echo "=========================================="
    echo ""
    echo "请访问: http://101.200.222.139:8082/login"
    echo "查看日志: ssh root@101.200.222.139 'pm2 logs embodied-marketing --lines 50'"
else
    echo ""
    echo "❌ 部署失败，请检查上方错误信息"
    exit 1
fi
