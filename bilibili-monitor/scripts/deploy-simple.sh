#!/bin/bash

echo "=========================================="
echo "  Embodied Marketing - 简化部署脚本"
echo "=========================================="

SERVER="root@101.200.222.139"
REMOTE_DIR="/root/embodied-marketing/bilibili-monitor"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "📁 本地目录: $LOCAL_DIR"
echo "🖥️  远程服务器: $SERVER:$REMOTE_DIR"
echo ""

echo "⚠️  此脚本将使用 tar+ssh 方式传输（比 rsync 更稳定）"
echo "请确保已配置 SSH 密钥或准备输入密码"
echo ""

read -p "是否继续？(y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 1
fi

echo ""
echo "📦 Step 1: 打包本地代码（排除 node_modules, .next, .git）..."
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
    -C "$LOCAL_DIR" .

if [ $? -eq 0 ]; then
    echo "   ✅ 打包完成: $(du -h /tmp/embodied-deploy.tar.gz | cut -f1)"
else
    echo "   ❌ 打包失败"
    exit 1
fi

echo ""
echo "🚀 Step 2: 上传到服务器..."
cat /tmp/embodied-deploy.tar.gz | ssh $SERVER "
    set -e
    echo '   📥 接收文件...'
    cd $REMOTE_DIR
    cp scripts/collect_status.json /tmp/collect_status.json.bak 2>/dev/null || true
    rm -rf src public scripts docs next.config.ts package.json tsconfig.json tailwind.config.ts postcss.config.js
    tar xz
    [ -f /tmp/collect_status.json.bak ] && mv /tmp/collect_status.json.bak scripts/collect_status.json
    echo '   ✅ 文件解压完成'
"

if [ $? -eq 0 ]; then
    echo "   ✅ 上传成功"
else
    echo "   ❌ 上传失败，请检查 SSH 连接"
    rm -f /tmp/embodied-deploy.tar.gz
    exit 1
fi

rm -f /tmp/embodied-deploy.tar.gz

echo ""
echo "🔨 Step 3: 在服务器上重新构建..."
ssh $SERVER << 'DEPLOY_EOF'
set -e
cd /root/embodied-marketing/bilibili-monitor

echo "停止当前服务..."
pm2 stop embodied-marketing 2>/dev/null || true
pm2 delete embodied-marketing 2>/dev/null || true

echo "清理旧的构建产物..."
rm -rf .next

echo "检查 Node.js 版本..."
node --version

echo "安装依赖..."
npm install --production=false 2>&1 | tail -5

echo "构建项目..."
npm run build 2>&1 | tail -20

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
