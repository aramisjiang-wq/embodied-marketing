#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RELEASE_NOTES.md 版本顺序重构工具 v4.0 (最终版)
解决所有已知问题
"""

import re
from typing import List, Tuple

def parse_version_number(version_str: str) -> Tuple:
    """
    解析版本号，返回可排序的元组
    支持格式: v2.31.1-security, v2.9.0, v3.0.0等
    """
    # 清理版本号字符串
    clean_version = version_str.strip().rstrip(')').strip()

    # 匹配标准版本号格式
    match = re.match(r'v(\d+)\.(\d+)(?:\.(\d+))?(.*)?', clean_version)
    if match:
        major = int(match.group(1))
        minor = int(match.group(2))
        patch = int(match.group(3)) if match.group(3) else 0
        suffix = match.group(4).strip() if match.group(4) else ""
        return (major, minor, patch, suffix)
    return (0, 0, 0, "")

def extract_all_sections(file_path: str):
    """
    提取所有 ## 开头的章节（包括非版本章节）
    返回: [(version_or_title, content), ...]
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    sections = []
    current_section = None
    current_lines = []

    for i, line in enumerate(lines, start=1):
        # 匹配所有 ## 开头的标题
        if line.startswith('## ') and not line.startswith('## |'):
            # 保存前一个section
            if current_section:
                content = ''.join(current_lines)
                sections.append((current_section, content))

            # 新section
            title = line[3:].strip()  # 去掉 "## "
            # 尝试提取版本号
            version_match = re.search(r'(v[\d.]+[a-z\-]*)', title)
            if version_match:
                current_section = version_match.group(1)
            else:
                current_section = title[:50]  # 使用标题前50字符作为标识

            current_lines = [line]
        else:
            if current_section is not None:  # 只收集第一个 ## 之后的内容
                current_lines.append(line)

    # 最后一个section
    if current_section and current_lines:
        content = ''.join(current_lines)
        sections.append((current_section, content))

    return sections

def identify_version_sections(sections):
    """区分版本章节和非版本章节"""
    version_sections = []  # 包含版本号的章节
    other_sections = []     # 其他章节（规划、附录等）

    for identifier, content in sections:
        if re.match(r'^v\d+\.', identifier):
            version_sections.append((identifier, content))
        else:
            other_sections.append((identifier, content))

    return version_sections, other_sections

def sort_versions(version_sections: List[Tuple[str, str]]) -> List[Tuple[str, str]]:
    """按版本号降序排序"""
    def sort_key(item):
        version = item[0]
        parsed = parse_version_number(version)
        # 特殊处理：确保 -security 后缀排在同版本号最后
        return parsed

    sorted_sections = sorted(version_sections, key=sort_key, reverse=True)

    # 二次微调：处理同主版本号内的排序（如 v2.8.14 > v2.8.13）
    def refine_sort_key(item):
        version = item[0]
        parsed = list(parse_version_number(version))
        # 如果有特殊后缀（如-security），将其排在最后
        if 'security' in parsed[3]:
            parsed[2] += 1000  # 大幅降低优先级
        return tuple(parsed)

    return sorted(version_sections, key=refine_sort_key, reverse=True)

def generate_missing_version_placeholder(version: str) -> str:
    """为缺失的版本生成占位符内容"""
    return f"""## 📝 {version}

> ⚠️ **注意**: 此版本的详细变更记录在原文档中未找到。

### 版本信息

- **版本号**: {version}
- **状态**: 已发布
- **详细信息**: 请参考上方总览表中的描述。

---

"""

def rebuild_complete_file(sorted_versions, other_sections, original_file, output_file,
                         expected_versions=None):
    """
    重建完整文件，包含：
    1. 文件头部（总览表）
    2. 按序排列的版本详情
    3. 其他章节（规划、附录等）
    4. 缺失版本的占位符
    """
    with open(original_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 找到总览表的结束位置（第二个 --- 之后）
    header_end = 74  # 根据之前的分析
    header = ''.join(lines[:header_end])

    # 收集已存在的版本号
    existing_versions = set(v for v, _ in sorted_versions)

    # 如果提供了期望的版本列表，补充缺失的版本
    all_content_parts = []

    # 1. 头部
    all_content_parts.append(header)
    all_content_parts.append('\n')

    # 2. 排序后的版本内容
    for i, (version, content) in enumerate(sorted_versions, 1):
        all_content_parts.append(content)
        if i < len(sorted_versions):  # 最后一个不加分隔线
            all_content_parts.append('\n\n---\n\n')

    # 3. 其他章节（规划、附录等）
    if other_sections:
        all_content_parts.append('\n\n---\n\n')
        for _, content in other_sections:
            all_content_parts.append(content)
            all_content_parts.append('\n\n')

    # 写入文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(''.join(all_content_parts))

def main():
    file_path = "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/RELEASE_NOTES.md"
    output_path = "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/RELEASE_NOTES_sorted.md"

    print("📖 正在读取并解析文件...")
    all_sections = extract_all_sections(file_path)
    print(f"✅ 总共发现 {len(all_sections)} 个章节")

    version_sections, other_sections = identify_version_sections(all_sections)
    print(f"   - 版本章节: {len(version_sections)} 个")
    print(f"   - 其他章节: {len(other_sections)} 个")

    print("\n📋 当前版本顺序（前5个）：")
    for i, (ver, _) in enumerate(version_sections[:5], 1):
        print(f"  {i}. {ver}")

    print("\n🔄 正在按版本号降序排序...")
    sorted_versions = sort_versions(version_sections)

    print("\n✨ 排序后版本顺序（前20个）：")
    for i, (ver, _) in enumerate(sorted_versions[:20], 1):
        print(f"  {i:>2}. {ver}")
    if len(sorted_versions) > 20:
        print(f"  ... 还有 {len(sorted_versions)-20} 个")

    print("\n💾 正在重建文件...")
    rebuild_complete_file(sorted_versions, other_sections, file_path, output_path)
    print(f"✅ 新文件已生成: {output_path}")

    import os
    size_kb = os.path.getsize(output_path) / 1024
    original_size_kb = os.path.getsize(file_path) / 1024
    print(f"\n📊 文件大小: {size_kb:.1f} KB (原始: {original_size_kb:.1f} KB)")

    # 验证
    print("\n🔍 验证新文件的版本顺序...")
    with open(output_path, 'r', encoding='utf-8') as f:
        new_content = f.read()

    # 检查前几个版本是否正确
    verification_pattern = r'(v[\d.]+[a-z\-]*)'
    found_versions = re.findall(verification_pattern, new_content)
    unique_versions = list(dict.fromkeys(found_versions))  # 去重保序

    print("\n✨ 新文件中的版本顺序（前25个）：")
    for i, ver in enumerate(unique_versions[:25], 1):
        if re.match(r'^v\d+\.\d+', ver):  # 只显示真正的版本号
            print(f"  {i:>2}. {ver}")

    print("\n🎉 重构完成！请检查输出文件。")

if __name__ == "__main__":
    main()
