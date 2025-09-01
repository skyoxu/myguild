#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将大的 PRD 文件分割为多个小文件，然后使用 Task Master 依次解析
"""

import os
import re
import subprocess
import json
from typing import List, Dict, Any
from pathlib import Path

def split_prd_by_sections(prd_path: str, output_dir: str) -> List[str]:
    """
    根据章节将 PRD 文件分割为多个小文件
    """
    with open(prd_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找所有章节标题（数字开头的行）
    sections = []
    lines = content.split('\n')
    current_section = []
    section_title = "前言"
    
    for i, line in enumerate(lines):
        # 检查是否是新章节（数字开头，如 "1. 执行摘要" 或 "3.1 核心游戏循环设计"）
        if re.match(r'^\d+\.', line.strip()):
            # 保存上一个章节
            if current_section:
                sections.append({
                    'title': section_title,
                    'content': '\n'.join(current_section)
                })
                current_section = []
            
            section_title = line.strip()
            current_section.append(line)
        else:
            current_section.append(line)
    
    # 保存最后一个章节
    if current_section:
        sections.append({
            'title': section_title,
            'content': '\n'.join(current_section)
        })
    
    # 创建输出目录
    Path(output_dir).mkdir(exist_ok=True)
    
    # 保存分割后的文件
    output_files = []
    for i, section in enumerate(sections):
        if len(section['content'].strip()) < 100:  # 跳过太小的章节
            continue
            
        # 清理文件名
        safe_title = re.sub(r'[^\w\s-]', '', section['title'])
        safe_title = re.sub(r'\s+', '-', safe_title)
        filename = f"section_{i+1:02d}_{safe_title[:30]}.txt"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(section['content'])
        
        output_files.append(filepath)
        print(f"创建章节文件: {filename} ({len(section['content'])} 字符)")
    
    return output_files

def parse_with_taskmaster(file_path: str, num_tasks: int = 10, append: bool = False) -> Dict[str, Any]:
    """
    使用 Task Master 解析单个 PRD 文件
    """
    cmd = [
        'npx', 'task-master-ai', 'parse-prd', 
        file_path,
        '-n', str(num_tasks),
        '--research'
    ]
    
    if append:
        cmd.append('--append')
    
    try:
        print(f"解析文件: {file_path}")
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=r'C:\buildgame\vitegame')
        
        if result.returncode == 0:
            print(f"成功解析: {file_path}")
            return {"success": True, "output": result.stdout}
        else:
            print(f"解析失败: {file_path}")
            print(f"错误信息: {result.stderr}")
            return {"success": False, "error": result.stderr}
    except Exception as e:
        print(f"执行命令时出错: {e}")
        return {"success": False, "error": str(e)}

def main():
    prd_file = r"C:\buildgame\vitegame\.taskmaster\docs\PRD-Guild-Manager-patched.txt"
    output_dir = r"C:\buildgame\vitegame\.taskmaster\docs\prd_sections"
    
    print("=== 步骤 1: 分割大 PRD 文件 ===")
    section_files = split_prd_by_sections(prd_file, output_dir)
    
    if not section_files:
        print("没有找到可分割的章节")
        return
    
    print(f"\n=== 步骤 2: 依次解析 {len(section_files)} 个章节 ===")
    
    # 计算每个文件应该生成多少任务
    tasks_per_section = max(1, 50 // len(section_files))
    remaining_tasks = 50 - (tasks_per_section * (len(section_files) - 1))
    
    success_count = 0
    failed_files = []
    
    for i, section_file in enumerate(section_files):
        # 最后一个文件获得剩余的任务数
        num_tasks = remaining_tasks if i == len(section_files) - 1 else tasks_per_section
        append = i > 0  # 除了第一个文件，其他都使用 append 模式
        
        result = parse_with_taskmaster(section_file, num_tasks, append)
        if result['success']:
            success_count += 1
        else:
            failed_files.append(section_file)
    
    print(f"\n=== 解析完成 ===")
    print(f"成功解析: {success_count}/{len(section_files)} 个文件")
    
    if failed_files:
        print(f"解析失败的文件:")
        for file in failed_files:
            print(f"  - {file}")
    
    # 清理临时文件
    print("\n=== 清理临时文件 ===")
    for section_file in section_files:
        try:
            os.remove(section_file)
            print(f"已删除: {os.path.basename(section_file)}")
        except:
            pass
    
    try:
        os.rmdir(output_dir)
        print(f"已删除目录: {output_dir}")
    except:
        pass

if __name__ == "__main__":
    main()