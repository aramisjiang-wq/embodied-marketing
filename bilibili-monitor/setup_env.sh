#!/bin/bash
# Python 环境快速配置脚本
# 用途：为 B站竞品数据采集系统配置 Python 3.11 环境
# 使用方法: chmod +x setup_env.sh && ./setup_env.sh

set -e  # 遇到错误立即退出

echo "🚀 B站数据采集系统 - Python 环境配置工具"
echo "================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_DIR="/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor"

# 检查函数
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

# Step 1: 检查 Homebrew
echo "📦 Step 1/5: 检查 Homebrew..."
if command -v brew &> /dev/null; then
    echo -e "${GREEN}✅ Homebrew 已安装: $(brew --version)${NC}"
else
    echo -e "${YELLOW}⚠️  未检测到 Homebrew，正在安装...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    check_success "Homebrew 安装"
fi

# Step 2: 安装 Python 3.11
echo ""
echo "🐍 Step 2/5: 安装 Python 3.11..."
if command -v python3.11 &> /dev/null; then
    PYTHON_VERSION=$(python3.11 --version)
    echo -e "${GREEN}✅ Python 3.11 已安装: ${PYTHON_VERSION}${NC}"
else
    echo "正在安装 Python 3.11（可能需要几分钟）..."
    brew install python@3.11
    check_success "Python 3.11 安装"
    
    # 添加到 PATH
    echo 'export PATH="/usr/local/opt/python@3.11/bin:$PATH"' >> ~/.zshrc
    export PATH="/usr/local/opt/python@3.11/bin:$PATH"
fi

# Step 3: 创建虚拟环境
echo ""
echo "🔧 Step 3/5: 创建虚拟环境..."
cd "$PROJECT_DIR"

if [ -d "venv" ]; then
    echo -e "${YELLOW}⚠️  虚拟环境已存在，是否删除并重新创建？(y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        rm -rf venv
        echo "已删除旧虚拟环境"
    else
        echo "保留现有虚拟环境"
    fi
fi

if [ ! -d "venv" ]; then
    python3.11 -m venv venv
    check_success "虚拟环境创建"
else
    echo -e "${GREEN}✅ 使用现有虚拟环境${NC}"
fi

# Step 4: 安装依赖包
echo ""
echo "📚 Step 4/5: 安装依赖包..."
source venv/bin/activate

echo "升级 pip..."
pip install --upgrade pip -q

echo "安装 bilibili-api-python 和 curl_cffi..."
pip install bilibili-api-python curl_cffi -q
check_success "依赖包安装"

# Step 5: 验证安装
echo ""
echo "✅ Step 5/5: 验证安装..."

echo "检查 Python 版本..."
PYTHON_VER=$(python --version)
echo -e "${GREEN}   版本: ${PYTHON_VER}${NC}"

echo "检查关键库..."
python -c "
import sys
print(f'Python: {sys.version.split()[0]}')

try:
    from bilibili_api import user, video, select_client, request_settings
    print('✅ bilibili-api: OK')
except ImportError as e:
    print(f'❌ bilibili-api: {e}')
    sys.exit(1)

try:
    import curl_cffi
    print('✅ curl_cffi: OK')
except ImportError as e:
    print(f'❌ curl_cffi: {e}')
    sys.exit(1)

try:
    import sqlite3
    db_path = 'bilibili_monitor.db'
    if __import__('os').path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM brands')
        count = cursor.fetchone()[0]
        print(f'✅ 数据库: OK (品牌数: {count})')
        conn.close()
    else:
        print('⚠️  数据库文件不存在')
except Exception as e:
    print(f'⚠️  数据库检查失败: {e}')
"

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo -e "${GREEN}🎉 环境配置完成！${NC}"
    echo "================================================"
    echo ""
    echo "下一步操作："
    echo "1. 激活虚拟环境:"
    echo "   cd \"$PROJECT_DIR\""
    echo "   source venv/bin/activate"
    echo ""
    echo "2. 运行数据采集:"
    echo "   cd scripts"
    echo "   python collect.py"
    echo ""
    echo "3. 查看日志:"
    echo "   tail -f logs/collect.log"
    echo ""
    echo -e "${YELLOW}提示: 每次打开新终端都需要执行 Step 1 激活虚拟环境${NC}"
    echo ""
    echo "详细文档请查看: docs/PYTHON_UPGRADE_GUIDE.md"
    echo "================================================"
else
    echo -e "${RED}❌ 验证失败，请查看错误信息${NC}"
    exit 1
fi
