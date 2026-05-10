# Python 环境升级指南

## 🎯 问题说明

您当前系统使用的是 **macOS 自带的 Python 3.9.6**，但 `bilibili-api` 库（特别是 `curl_cffi` 组件）需要 **Python 3.10+** 才能正常运行。

**错误信息示例：**
```
TypeError: changelist must be an iterable of select.kevent objects
```

这是 macOS Python 3.9 的已知兼容性问题。

---

## ✅ 解决方案：安装 Python 3.11（推荐）

### 方案一：使用 Homebrew 安装（推荐）

#### 1. 检查是否已安装 Homebrew

```bash
brew --version
```

如果未安装，执行：
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 2. 安装 Python 3.11

```bash
# 安装 Python 3.11
brew install python@3.11

# 验证安装
python3.11 --version
# 应该输出: Python 3.11.x
```

#### 3. 创建虚拟环境

```bash
cd "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor"

# 创建虚拟环境（使用 Python 3.11）
python3.11 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 验证 Python 版本
python --version
# 应该输出: Python 3.11.x
```

#### 4. 安装依赖包

```bash
# 升级 pip
pip install --upgrade pip

# 安装核心依赖
pip install bilibili-api-python curl_cffi

# 验证安装
python -c "from bilibili_api import user; print('✅ bilibili-api 安装成功')"
```

#### 5. 运行采集脚本

```bash
# 确保在虚拟环境中
cd scripts

# 运行新版本的采集脚本
python collect.py
```

---

### 方案二：使用官方安装包（备选）

如果不想使用 Homebrew，可以从官网下载：

1. 访问：https://www.python.org/downloads/
2. 下载 **Python 3.11.x** 或 **3.12.x** 的 macOS 安装包
3. 双击安装（按照向导操作）
4. 安装完成后，在终端验证：
   ```bash
   python3.11 --version
   ```

然后按照方案一的步骤 3-5 操作。

---

## 🚀 快速启动脚本（一键配置）

我已经为您创建了一个自动化脚本，可以快速完成环境配置：

```bash
#!/bin/bash
# save as: setup_python_env.sh

echo "🚀 开始配置 Python 3.11 环境..."

# 1. 检查 Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ 未检测到 Homebrew，正在安装..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew 已安装"
fi

# 2. 安装 Python 3.11
echo "📦 安装 Python 3.11..."
brew install python@3.11

# 3. 创建虚拟环境
echo "🔧 创建虚拟环境..."
cd "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor"
python3.11 -m venv venv

# 4. 激活并安装依赖
echo "📚 安装依赖包..."
source venv/bin/activate
pip install --upgrade pip
pip install bilibili-api-python curl_cffi

# 5. 验证
echo "✅ 验证安装..."
python --version
python -c "from bilibili_api import user, video; print('✅ 所有依赖安装成功')"

echo ""
echo "🎉 环境配置完成！"
echo "运行命令: cd scripts && python collect.py"
```

**使用方法：**
```bash
# 保存脚本后执行
chmod +x setup_python_env.sh
./setup_python_env.sh
```

---

## 📋 常见问题排查

### 问题1: `command not found: python3.11`

**解决方案：**
```bash
# 重新加载 Shell 配置
source ~/.zshrc  # 或 ~/.bash_profile

# 或者直接使用完整路径
/usr/local/opt/python@3.11/bin/python3.11 --version
```

### 问题2: pip 安装速度慢

**解决方案：使用国内镜像源**
```bash
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple bilibili-api-python curl_cffi
```

### 问题3: 虚拟环境激活失败

**解决方案：**
```bash
# 删除旧的环境
rm -rf venv

# 重新创建
python3.11 -m venv venv
source venv/bin/activate
```

### 问题4: 权限错误

**解决方案：**
```bash
# 在用户目录下操作，避免系统目录权限问题
# 确保在项目目录下创建虚拟环境
cd ~/Projects/bilibili-monitor  # 您的项目路径
```

---

## 🔧 环境验证清单

完成安装后，请依次运行以下命令验证：

```bash
# 1. 检查 Python 版本
python --version
# 期望输出: Python 3.11.x (或 3.12.x)

# 2. 检查关键库
python -c "
import sys
print(f'Python 版本: {sys.version}')
print(f'Python 路径: {sys.executable}')

try:
    from bilibili_api import user, video, select_client, request_settings
    print('✅ bilibli-api: OK')
except ImportError as e:
    print(f'❌ bilibili-api: {e}')

try:
    import curl_cffi
    print('✅ curl_cffi: OK')
except ImportError as e:
    print(f'❌ curl_cffi: {e}')
"

# 3. 测试数据库连接
python -c "
import sqlite3
import os
db_path = os.path.join('..', 'bilibili_monitor.db')
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM brands')
    count = cursor.fetchone()[0]
    print(f'✅ 数据库连接成功，品牌数: {count}')
    conn.close()
else:
    print('❌ 数据库文件不存在')
"
```

**期望输出：**
```
Python 版本: 3.11.x (main, ...)
Python 路径: .../bilibili-monitor/venv/bin/python
✅ bilibli-api: OK
✅ curl_cffi: OK
✅ 数据库连接成功，品牌数: XX
```

---

## 📖 使用指南

### 日常使用流程

#### 1. 激活虚拟环境（每次打开终端都需要）

```bash
cd "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor"
source venv/bin/activate
```

提示符应该变为：`(venv) $`

#### 2. 运行数据采集

```bash
cd scripts
python collect.py
```

#### 3. 查看日志

```bash
# 实时查看日志
tail -f logs/collect.log

# 查看最近100行
tail -n 100 logs/collect.log
```

#### 4. 退出虚拟环境

```bash
deactivate
```

---

## ⚙️ 高级配置（可选）

### 设置自动激活虚拟环境

如果您想每次进入项目目录时自动激活虚拟环境：

```bash
# 编辑 .zshrc 或 .bash_profile
nano ~/.zshrc

# 在末尾添加：
auto_activate_venv() {
    if [[ -d "./venv" ]]; then
        source ./venv/bin/activate
    }
}
chpwd_functions=( auto_activate_venv $chpwd_functions )

# 保存退出
source ~/.zshrc
```

### 配置 VS Code 使用虚拟环境

1. 打开项目文件夹
2. 按 `Cmd+Shift+P`
3. 输入 "Python: Select Interpreter"
4. 选择 `./venv/bin/python`

### 配置 PyCharm 使用虚拟环境

1. File → Settings → Project → Python Interpreter
2. 点击齿轮图标 → Add
3. 选择 "Existing environment"
4. 浏览到 `venv/bin/python`
5. 点击 OK

---

## 🔄 回滚方案（如果遇到问题）

如果新版本有问题，可以快速回退：

```bash
# 1. 删除虚拟环境
rm -rf venv

# 2. 使用旧版本的兼容脚本（如果需要）
python3 collect_py39.py  # 注意：可能仍有兼容性问题
```

---

## 📞 技术支持

如果遇到其他问题：

1. **检查日志**：`logs/collect.log`
2. **查看错误信息**：完整复制错误堆栈
3. **参考文档**：[数据采集指南](./数据采集指南.md)
4. **GitHub Issues**：[bilibili-api Issues](https://github.com/Nemo2011/bilibili-api/issues)

---

## ✨ 下一步

完成 Python 升级后：

1. ✅ **立即测试** - 运行 `python collect.py`
2. ✅ **查看结果** - 检查数据库和日志
3. ✅ **设置定时任务** - 可选，参考 [数据采集指南](./数据采集指南.md)
4. ✅ **监控运行状态** - 定期查看 `run_logs` 表

---

**祝您升级顺利！如有任何问题，请随时查阅本文档。** 🚀
