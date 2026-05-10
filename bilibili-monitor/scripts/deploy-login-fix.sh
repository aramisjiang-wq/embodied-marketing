#!/bin/bash

echo "=========================================="
echo "  Embodied Marketing - Login Fix Deployment"
echo "=========================================="

# 配置
SERVER="root@101.200.222.139"
REMOTE_DIR="/root/embodied-marketing/bilibili-monitor"
LOCAL_DIR="/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor"

echo ""
echo "📋 Step 1: 验证本地代码更改..."
if grep -q "Initializing direct redirect flow" "$LOCAL_DIR/src/app/login/page.tsx"; then
    echo "   ✅ 本地代码已更新为直接重定向版本"
else
    echo "   ❌ 错误：本地代码未更新"
    exit 1
fi

echo ""
echo "📋 Step 2: 同步代码到服务器..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '*.log' \
    "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

if [ $? -ne 0 ]; then
    echo "   ❌ rsync 失败，请检查 SSH 连接"
    exit 1
fi

echo "   ✅ 代码同步完成"

echo ""
echo "📋 Step 3: 在服务器上重新构建..."

ssh $SERVER << 'EOF'
cd /root/embodied-marketing/bilibili-monitor

echo "停止当前服务..."
pm2 stop embodied-marketing 2>/dev/null || true
pm2 delete embodied-marketing 2>/dev/null || true

echo "清理旧的构建产物..."
rm -rf .next

echo "安装依赖（如需要）..."
npm install --production=false

echo "构建项目..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ 构建成功"
else
    echo "❌ 构建失败"
    exit 1
fi

echo "启动服务..."
pm2 start npm --name "embodied-marketing" -- start -p 8082
pm2 save

echo "✅ 服务已启动"
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  ✅ 部署完成！"
    echo "=========================================="
    echo ""
    echo "请访问: http://101.200.222.139:8082/login"
    echo "测试登录功能"
    echo ""
    echo "查看日志: pm2 logs embodied-marketing"
else
    echo ""
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi
