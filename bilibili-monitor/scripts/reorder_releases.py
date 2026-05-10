#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RELEASE_NOTES.md 版本顺序重构工具 v3.0
自动按版本号降序重新排列所有版本内容
"""

import re
from typing import List, Tuple

def parse_version_number(version_str: str) -> Tuple:
    """
    解析版本号，返回可排序的元组
    例如: "v2.31.1-security" → (2, 31, 1, "-security")
          "v2.9.0" → (2, 9, 0, "")
    """
    match = re.match(r'v(\d+)\.(\d+)(?:\.(\d+))?(.*)?', version_str)
    if match:
        major = int(match.group(1))
        minor = int(match.group(2))
        patch = int(match.group(3)) if match.group(3) else 0
        suffix = match.group(4) or ""
        return (major, minor, patch, suffix)
    return (0, 0, 0, "")

def extract_version_blocks(file_path: str) -> List[Tuple[str, str]]:
    """
    从Markdown文件中提取所有版本内容块
    返回: [(version, content), ...]
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 找出所有以 ## 开头的版本标题行（包含emoji）
    version_blocks = []
    current_version = None
    current_content_lines = []

    for i, line in enumerate(lines):
        # 匹配版本标题：## + emoji + 版本号
        if line.startswith('##') and re.search(r'v\d+\.', line):
            # 如果已经有当前版本，保存它
            if current_version:
                content = '\n'.join(current_content_lines).rstrip()
                if content:
                    version_blocks.append((current_version, content))

            # 开始新版本
            current_version = line.strip().split()[-1] if line.strip() else f"unknown_{i}"
            current_content_lines = [line]
        elif current_version:
            # 添加到当前版本内容
            current_content_lines.append(line)

    # 最后一个版本
    if current_version and current_content_lines:
        content = '\n'.join(current_content_lines).rstrip()
        if content:
            version_blocks.append((current_version, content))

    return version_blocks

def sort_versions(blocks: List[Tuple[str, str]]) -> List[Tuple[str, str]]:
    """按版本号降序排序"""
    def sort_key(item):
        version = item[0]
        return parse_version_number(version)

    return sorted(blocks, key=sort_key, reverse=True)

def rebuild_file(blocks: List[Tuple[str, str]], original_file: str, output_file: str):
    """重建文件"""
    with open(original_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 提取头部（总览表部分，到第74行）
    header_end = 74
    header = ''.join(lines[:header_end])

    # 排序后的版本内容
    sorted_content = '\n\n---\n\n'.join(content for _, content in blocks)

    # 写入新文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(header)
        f.write('\n')
        f.write(sorted_content)
        f.write('\n')

def main():
    file_path = "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/RELEASE_NOTES.md"
    output_path = "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing/bilibili-monitor/RELEASE_NOTES_sorted.md"

    print("📖 正在读取文件...")
    blocks = extract_version_blocks(file_path)
    print(f"✅ 发现 {len(blocks)} 个版本块")

    print("\n📋 当前顺序（前10个）：")
    for i, (ver, _) in enumerate(blocks[:10], 1):
        print(f"  {i}. {ver}")
    if len(blocks) > 10:
        print(f"  ... 还有 {len(blocks)-10} 个")

    print("\n🔄 正在按版本号排序...")
    sorted_blocks = sort_versions(blocks)

    print("\n✨ 排序后顺序（前15个）：")
    for i, (ver, _) in enumerate(sorted_blocks[:15], 1):
        print(f"  {i}. {ver}")

    print("\n💾 正在写入新文件...")
    rebuild_file(sorted_blocks, file_path, output_path)
    print(f"✅ 新文件已生成: {output_path}")

    import os
    size_kb = os.path.getsize(output_path) / 1024
    original_size_kb = os.path.getsize(file_path) / 1024
    print(f"\n📊 文件大小: {size_kb:.1f} KB (原始: {original_size_kb:.1f} KB)")
    print("\n🎉 重构完成！")

if __name__ == "__main__":
    main()
