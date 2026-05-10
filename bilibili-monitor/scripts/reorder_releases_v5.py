#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RELEASE_NOTES.md 最终重构工具 v5.0 (智能补全版)
功能：
1. 提取所有现有版本内容
2. 从总览表提取缺失版本的摘要信息
3. 为缺失版本生成标准化的简短章节
4. 按完美降序排列所有内容
5. 输出结构完美的文件
"""

import re
from typing import List, Tuple, Dict

def parse_version_number(version_str: str) -> Tuple:
    """解析版本号为可排序的元组"""
    clean = version_str.strip().rstrip(')').strip()
    match = re.match(r'v(\d+)\.(\d+)(?:\.(\d+))?(.*)?', clean)
    if match:
        return (
            int(match.group(1)),
            int(match.group(2)),
            int(match.group(3)) if match.group(3) else 0,
            match.group(4).strip() if match.group(4) else ""
        )
    return (0, 0, 0, "")

def extract_overview_table(file_path: str) -> Dict[str, str]:
    """
    从总览表中提取所有版本信息
    返回: {version: summary_line}
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    overview_data = {}

    # 匹配表格行：| version | date | type | description | status |
    pattern = r'\|\s*\*?\*(v[\d.\w\-]+)\*?\*\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|'

    for match in re.finditer(pattern, content):
        version = match.group(1)
        date = match.group(2)
        change_type = match.group(3).strip()
        description = match.group(4).strip()
        status = match.group(5).strip()

        # 清理markdown格式
        description = re.sub(r'\*\*', '', description)

        overview_data[version] = {
            'date': date,
            'type': change_type,
            'description': description,
            'status': status
        }

    return overview_data

def extract_detailed_sections(file_path: str) -> List[Tuple[str, str]]:
    """提取所有 ## 版本标题的详细章节"""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    sections = []
    current_version = None
    current_lines = []

    for line in lines:
        if line.startswith('## ') and re.search(r'v\d+\.', line):
            if current_version and current_lines:
                content = ''.join(current_lines)
                if len(content.strip()) > 50:  # 过滤太短的内容
                    sections.append((current_version, content))

            # 提取版本号
            match = re.search(r'(v[\d.]+[a-z\-]*)', line)
            current_version = match.group(1) if match else "unknown"
            current_lines = [line]
        elif current_version:
            current_lines.append(line)

    # 最后一个section
    if current_version and current_lines:
        content = ''.join(current_lines)
        if len(content.strip()) > 50:
            sections.append((current_version, content))

    return sections

def generate_version_section(version: str, info: Dict) -> str:
    """根据总览表信息生成标准化的版本章节"""
    emoji_map = {
        '🛡️': ['security', '修复', '安全'],
        '🎨': ['UI', '优化', '体验', '视觉'],
        '✨': ['新增', '功能'],
        '🚀': ['性能', '升级', '重构'],
        '🐛': ['Bug', '修复', '问题'],
        '📊': ['数据', '图表', '分析'],
        '🔧': ['优化', '改进', '调整'],
        '💎': ['产品', '重构', '设计'],
        '🤖': ['自动化', '采集'],
        '🎯': ['目标', '完成']
    }

    # 根据描述选择合适的emoji
    emoji = '📝'  # 默认
    desc_lower = info.get('description', '').lower()
    for em, keywords in emoji_map.items():
        if any(kw in desc_lower for kw in keywords):
            emoji = em
            break

    return f"""## {emoji} {version}

> **发布日期**: {info.get('date', '未知')}
> **变更类型**: {info.get('type', '未知')}
> **状态**: {info.get('status', '已完成')}

### 主要变更

{info.get('description', '暂无详细信息')}

---

"""

def sort_all_versions(items: List[Tuple]) -> List[Tuple]:
    """按版本号完美降序排序"""
    def sort_key(item):
        version = item[0]
        parsed = list(parse_version_number(version))
        # 特殊处理：-security 后缀排最后
        if 'security' in parsed[3]:
            parsed[2] += 1000
        return tuple(parsed)

    return sorted(items, key=sort_key, reverse=True)

def build_final_file(sorted_items: List[Tuple], original_file: str, output_file: str):
    """构建最终的完美文件"""
    with open(original_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 头部（到第74行）
    header = ''.join(lines[:74])

    parts = [header]

    for i, (version, content) in enumerate(sorted_items):
        parts.append(content)
        parts.append('\n')

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(''.join(parts))

def main():
    file_path = "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/RELEASE_NOTES.md"
    output_path = "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/RELEASE_NOTES_final.md"

    print("🔍 步骤1: 提取总览表信息...")
    overview = extract_overview_table(file_path)
    print(f"   ✅ 找到 {len(overview)} 个版本记录")

    print("\n📖 步骤2: 提取详细章节...")
    detailed = extract_detailed_sections(file_path)
    print(f"   ✅ 找到 {len(detailed)} 个详细章节")

    print("\n🧩 步骤3: 智能补全缺失版本...")
    detailed_versions = set(v for v, _ in detailed)
    all_versions = set(overview.keys())

    missing = all_versions - detailed_versions
    print(f"   ℹ️  详细章节: {len(detailed_versions)}")
    print(f"   ⚠️  缺失版本: {len(missing)}")

    # 为缺失的版本生成占位符
    completed_items = list(detailed)
    for version in sorted(missing, key=parse_version_number, reverse=True):
        if version in overview:
            placeholder = generate_version_section(version, overview[version])
            completed_items.append((version, placeholder))

    print("\n🔄 步骤4: 按版本号降序排列所有内容...")
    sorted_items = sort_all_versions(completed_items)

    print("\n✨ 最终版本顺序（前30个）：")
    for i, (ver, _) in enumerate(sorted_items[:30], 1):
        has_detail = "✅" if ver in detailed_versions else "📝"
        print(f"  {i:>2}. {has_detail} {ver}")
    if len(sorted_items) > 30:
        print(f"     ... 还有 {len(sorted_items)-30} 个")

    print("\n💾 步骤5: 写入最终文件...")
    build_final_file(sorted_items, file_path, output_path)

    import os
    size_kb = os.path.getsize(output_path) / 1024
    print(f"\n✅ 文件已生成: {output_path}")
    print(f"📊 文件大小: {size_kb:.1f} KB")
    print(f"📈 版本总数: {len(sorted_items)} (含 {len(detailed)} 个详细 + {len(missing)} 个补充)")

    print("\n🎉 重构完成！文件已按完美降序排列。")

if __name__ == "__main__":
    main()
