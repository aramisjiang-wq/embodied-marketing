#!/bin/bash

echo "=========================================="
echo "  🏥 Embodied Marketing - 飞书登录诊断"
echo "=========================================="
echo ""

SERVER="root@101.200.222.139"

ssh $SERVER << 'DIAG_EOF'
set -e

cd /root/embodied-marketing/bilibili-monitor

echo "📋 1️⃣  检查服务运行状态..."
echo "----------------------------------------"
pm2 status embodied-marketing 2>/dev/null || echo "⚠️  服务未运行"
echo ""

echo "📋 2️⃣  检查端口监听..."
echo "----------------------------------------"
netstat -tlnp | grep 8082 || echo "⚠️  端口 8082 未监听"
lsof -i :8082 2>/dev/null || echo ""
echo ""

echo "📋 3️⃣  检查 login 页面代码版本..."
echo "----------------------------------------"
if [ -f src/app/login/page.tsx ]; then
    echo "✅ 文件存在"
    
    # 检查是 QR 版本还是 Redirect 版本
    if grep -q "QRLogin" src/app/login/page.tsx; then
        echo "❌ 当前版本: QRLogin SDK 二维码版本（有问题）"
        echo "   问题点:"
        grep -n "QR container not found\|qrContainerRef\|window.QRLogin" src/app/login/page.tsx | head -5
    elif grep -q "direct redirect flow" src/app/login/page.tsx; then
        echo "✅ 当前版本: 直接重定向版本（已修复）"
    else
        echo "⚠️  无法识别版本"
    fi
    
    # 显示关键行
    echo ""
    echo "   关键代码段 (第 24-30 行):"
    sed -n '24,30p' src/app/login/page.tsx
else
    echo "❌ 文件不存在!"
fi
echo ""

echo "📋 4️⃣  检查构建产物..."
echo "----------------------------------------"
if [ -d .next ]; then
    echo "✅ .next 目录存在"
    
    # 检查 login 页面是否已构建
    if [ -f .next/server/app/login/page.js ]; then
        echo "✅ Login 页面已构建"
        
        # 检查构建产物中的版本
        if grep -q "QRLogin" .next/server/app/login/page.js; then
            echo "❌ 构建产物仍是旧版 (QRLogin)"
            echo "   ⚠️  需要重新构建: npm run build"
        else
            echo "✅ 构建产物已是新版 (Direct Redirect)"
        fi
    else
        echo "❌ Login 页面未找到，需要重新构建"
    fi
else
    echo "❌ .next 目录不存在，项目未构建"
fi
echo ""

echo "📋 5️⃣  检查飞书 API 配置..."
echo "----------------------------------------"
if [ -f .env.local ]; then
    echo "✅ .env.local 存在"
    
    # 检查关键配置（隐藏敏感信息）
    echo "   FEISHU_APP_ID: $(grep FEISHU_APP_ID .env.local | cut -d= -f2 | sed 's/.\{4\}$/***/')"
    echo "   FEISHU_APP_SECRET: $(grep FEISHU_APP_SECRET .env.local | cut -d= -f2 | sed 's/.\{4\}$/***/')"
    echo "   NEXT_PUBLIC_BASE_URL: $(grep NEXT_PUBLIC_BASE_URL .env.local | cut -d= -f2)"
else
    echo "❌ .env.local 不存在!"
fi
echo ""

echo "📋 6️⃣  测试飞书 API 接口..."
echo "----------------------------------------"
if pm2 pid embodied-marketing > /dev/null 2>&1; then
    PID=$(pm2 pid embodied-marketing)
    echo "服务 PID: $PID"
    
    # 尝试调用 API（本地调用）
    echo "测试 /api/auth/feishu 接口..."
    RESPONSE=$(curl -s http://localhost:8082/api/auth/feishu 2>&1 || echo "curl 失败")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo "✅ API 返回成功"
        AUTH_URL=$(echo $RESPONSE | grep -o '"auth_url":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$AUTH_URL" ]; then
            echo "✅ 获取到授权 URL: ${AUTH_URL:0:50}..."
        else
            echo "❌ 返回数据中无 auth_url"
            echo "   完整响应: $RESPONSE"
        fi
    elif echo "$RESPONSE" | grep -q '"success":false'; then
        ERROR_MSG=$(echo $RESPONSE | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        echo "❌ API 返回错误: $ERROR_MSG"
        echo "   完整响应: $RESPONSE"
    else
        echo "⚠️  API 响应异常或服务未启动"
        echo "   响应: ${RESPONSE:0:200}"
    fi
else
    echo "⚠️  服务未运行，无法测试 API"
fi
echo ""

echo "📋 7️⃣  检查最近日志..."
echo "----------------------------------------"
if command -v pm2 &> /dev/null && pm2 pid embodied-marketing > /dev/null 2>&1; then
    echo "最近 20 行 PM2 日志:"
    pm2 logs embodied-marketing --lines 20 --nostream 2>/dev/null || echo "无法获取日志"
else
    echo "服务未运行，无日志"
fi
echo ""

echo "=========================================="
echo "  📊 诊断总结"
echo "=========================================="
echo ""

# 综合判断
ISSUES=0

if ! pm2 pid embodied-marketing > /dev/null 2>&1; then
    echo "❌ 问题 1: 服务未运行 → 执行 pm2 启动"
    ((ISSUES++))
fi

if grep -q "QRLogin" src/app/login/page.tsx 2>/dev/null; then
    echo "❌ 问题 2: 代码是旧版 QRLogin → 需要更新为直接重定向版本"
    ((ISSUES++))
fi

if [ -d .next ] && grep -q "QRLogin" .next/server/app/login/page.js 2>/dev/null; then
    echo "❌ 问题 3: 构建产物过时 → 需要重新 npm run build"
    ((ISSUES++))
fi

if [ $? -eq 0 ] && [ $ISSUES -eq 0 ]; then
    echo "✅ 所有检查通过！飞书登录应该正常工作"
    echo ""
    echo "请访问: http://101.200.222.139:8082/login 测试"
else
    echo ""
    echo "发现 $ISSUES 个问题，请按上述提示修复"
    echo ""
    echo "快速修复命令:"
    echo "  cd /root/embodied-marketing/bilibili-monitor"
    echo "  pm2 stop embodied-marketing; pm2 delete embodied-marketing"
    echo "  rm -rf .next"
    echo "  # 更新 src/app/login/page.tsx 为新版"
    echo "  npm run build"
    echo "  pm2 start npm --name 'embodied-marketing' -- start -p 8082"
    echo "  pm2 save"
fi

DIAG_EOF
