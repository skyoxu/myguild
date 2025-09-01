#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PRD 文件切割和任务生成脚本
基于 zen mcp 的建议，将大型 PRD 文件切割成小块，避免 ENAMETOOLONG 错误
"""

import os
import re
import json
import subprocess
import tempfile
import shutil

# --- 配置 ---
PRD_FILE_PATH = r"C:\buildgame\vitegame\.taskmaster\docs\PRD-Guild-Manager-patched.txt"
OUTPUT_DIR = r".taskmaster\tasks"
FINAL_TASKS_FILE = os.path.join(OUTPUT_DIR, "tasks.json")
NUM_FINAL_TASKS = 50
NUM_TASKS_PER_CHUNK = 8  # 每个章节期望生成的任务数量，6-8个章节 * 8 = 48-64个初步任务

# --- 辅助函数 ---

def read_prd_file(file_path):
    """读取 PRD 文件内容"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"错误：PRD 文件未找到：{file_path}")
        exit(1)
    except Exception as e:
        print(f"读取 PRD 文件出错：{e}")
        exit(1)

def split_prd_by_chapters(prd_content):
    """
    根据章节标题切割 PRD 内容
    为每个章节添加全局上下文（标题、目录）
    """
    chapters = []
    
    # 提取整体标题
    overall_title_match = re.match(r'《.+》产品需求文档 \(PRD\)', prd_content)
    overall_title = overall_title_match.group(0) if overall_title_match else ""
    
    # 提取目录部分
    toc_start_marker = '📋 目录'
    toc_start_idx = prd_content.find(toc_start_marker)
    
    global_context_prefix = ""
    if overall_title:
        global_context_prefix += overall_title + "\n\n"
    
    if toc_start_idx != -1:
        # 查找目录结束位置（通常在第一个实际章节之前）
        # 查找分隔线或第一个数字开头的章节
        lines = prd_content[toc_start_idx:].split('\n')
        toc_lines = [toc_start_marker]
        
        for i, line in enumerate(lines[1:], 1):
            if line.strip().startswith('--------') or re.match(r'^\d+\.', line.strip()):
                break
            toc_lines.append(line)
        
        full_toc_section = '\n'.join(toc_lines).strip()
        global_context_prefix += full_toc_section + "\n\n"
    
    # 查找章节标题模式（数字开头的章节，如 "1. 执行摘要"）
    chapter_pattern = re.compile(r'^(\d+\.\s+.+)$', re.MULTILINE)
    matches = list(chapter_pattern.finditer(prd_content))
    
    if not matches:
        print("警告：未找到数字章节标题。将整个 PRD 作为单个块处理。")
        return [{"title": "完整 PRD", "content": global_context_prefix + prd_content.strip()}]
    
    print(f"找到 {len(matches)} 个章节")
    
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i+1].start() if i + 1 < len(matches) else len(prd_content)
        chapter_title = match.group(1).strip()
        chapter_content = prd_content[start:end].strip()
        
        # 为每个章节添加全局上下文前缀
        full_chapter_chunk = f"{global_context_prefix}{chapter_content}"
        chapters.append({
            "title": chapter_title, 
            "content": full_chapter_chunk,
            "token_estimate": len(full_chapter_chunk) // 4  # 粗略估算 token 数
        })
    
    return chapters

def call_task_master(input_file_path, num_tasks, output_dir):
    """
    调用 task-master CLI 工具处理指定的输入文件
    """
    command = [
        "npx", "task-master", "parse-prd", 
        f"--input={input_file_path}", 
        f"--num-tasks={num_tasks}",
        "--force"  # 跳过确认，自动覆盖
    ]
    
    # task-master 默认输出到 .taskmaster/tasks/tasks.json
    default_output = os.path.join(output_dir, "tasks.json")
    
    print(f"执行命令：{' '.join(command)}")
    try:
        result = subprocess.run(
            command, 
            capture_output=True, 
            text=True, 
            check=True, 
            shell=True, 
            encoding='utf-8',
            timeout=300  # 5分钟超时
        )
        
        print(f"task-master 输出：\n{result.stdout.strip()}")
        if result.stderr.strip():
            print(f"task-master 错误输出：\n{result.stderr.strip()}")
        
        # 读取生成的任务文件
        if os.path.exists(default_output):
            with open(default_output, 'r', encoding='utf-8') as f:
                tasks_data = json.load(f)
            
            # 提取任务列表（task-master 的输出格式可能有所不同）
            if isinstance(tasks_data, dict) and 'tasks' in tasks_data:
                tasks = tasks_data['tasks']
            elif isinstance(tasks_data, list):
                tasks = tasks_data
            else:
                print(f"警告：未知的任务数据格式：{type(tasks_data)}")
                tasks = []
            
            # 删除文件以避免下次调用时的混淆
            os.remove(default_output)
            return tasks
        else:
            print(f"警告：task-master 未生成输出文件：{default_output}")
            return []
            
    except subprocess.TimeoutExpired:
        print(f"错误：task-master 调用超时（5分钟），输入文件：{input_file_path}")
        return []
    except subprocess.CalledProcessError as e:
        print(f"错误：task-master 调用失败，输入文件：{input_file_path}")
        print(f"命令：{' '.join(command)}")
        print(f"返回码：{e.returncode}")
        print(f"标准错误：{e.stderr.strip()}")
        print(f"标准输出：{e.stdout.strip()}")
        
        # 检查是否仍然是 ENAMETOOLONG 错误
        if "ENAMETOOLONG" in e.stderr or "argument list too long" in e.stderr:
            print("\n严重错误：即使切割后仍出现 'spawn ENAMETOOLONG' 错误！")
            print("建议：进一步减小切片大小或绕过 task-master 直接调用 Gemini API")
        
        return []
    except Exception as e:
        print(f"意外错误：{e}")
        return []

def save_final_tasks(all_tasks, output_file):
    """
    保存最终任务到文件
    使用 task-master 期望的 JSON 格式
    """
    # 去重并整理任务
    unique_tasks = {}
    for task in all_tasks:
        # 使用标题作为去重键
        title = task.get('title', '') or task.get('name', '')
        if title and title not in unique_tasks:
            # 确保任务有必要的字段
            formatted_task = {
                'id': len(unique_tasks) + 1,
                'title': title,
                'description': task.get('description', ''),
                'status': 'pending',
                'priority': task.get('priority', 'medium'),
                'dependencies': task.get('dependencies', []),
                'details': task.get('details', ''),
                'testStrategy': task.get('testStrategy', '')
            }
            unique_tasks[title] = formatted_task
    
    final_tasks = list(unique_tasks.values())
    
    # 如果任务数量超过目标数量，取前 N 个
    if len(final_tasks) > NUM_FINAL_TASKS:
        final_tasks = final_tasks[:NUM_FINAL_TASKS]
        print(f"任务数量从 {len(unique_tasks)} 个截取到 {NUM_FINAL_TASKS} 个")
    
    # 重新分配 ID
    for i, task in enumerate(final_tasks, 1):
        task['id'] = i
    
    # 保存为 task-master 格式
    output_data = {
        'tasks': final_tasks,
        'metadata': {
            'totalTasks': len(final_tasks),
            'generatedAt': '2025-08-28',
            'source': 'PRD-Guild-Manager-patched.txt (分块处理)',
            'method': 'chunk-based-generation'
        }
    }
    
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    return len(final_tasks)

def main():
    """主执行函数"""
    print("=" * 60)
    print("PRD 切割和任务生成脚本")
    print("=" * 60)
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 创建临时目录存放切片文件
    temp_dir = tempfile.mkdtemp()
    print(f"创建临时目录：{temp_dir}")
    
    try:
        # 读取 PRD 文件
        print(f"读取 PRD 文件：{PRD_FILE_PATH}")
        prd_content = read_prd_file(PRD_FILE_PATH)
        print(f"PRD 文件大小：{len(prd_content)} 字符")
        
        # 切割成章节
        print("\n切割 PRD 文件...")
        chapters = split_prd_by_chapters(prd_content)
        print(f"切割完成，共 {len(chapters)} 个章节")
        
        # 显示章节信息
        for i, chapter in enumerate(chapters):
            print(f"  章节 {i+1}: {chapter['title']} ({chapter['token_estimate']} tokens)")
        
        # 处理每个章节
        all_generated_tasks = []
        
        for i, chapter in enumerate(chapters):
            chapter_title = chapter['title']
            chapter_content = chapter['content']
            
            # 创建临时 txt 文件
            temp_file_path = os.path.join(temp_dir, f"chapter_{i+1}.txt")
            with open(temp_file_path, 'w', encoding='utf-8') as temp_file:
                temp_file.write(chapter_content)
            
            print(f"\n处理章节 {i+1}/{len(chapters)}: {chapter_title}")
            print(f"  临时文件：{temp_file_path}")
            print(f"  估算大小：{chapter['token_estimate']} tokens")
            
            try:
                # 调用 task-master 处理该章节
                chapter_tasks = call_task_master(temp_file_path, NUM_TASKS_PER_CHUNK, OUTPUT_DIR)
                all_generated_tasks.extend(chapter_tasks)
                print(f"  生成任务数：{len(chapter_tasks)}")
                print(f"  累计任务数：{len(all_generated_tasks)}")
                
            except Exception as e:
                print(f"  处理章节失败：{e}")
                continue
        
        # 保存最终任务
        if all_generated_tasks:
            print(f"\n保存最终任务...")
            print(f"原始任务总数：{len(all_generated_tasks)}")
            
            final_count = save_final_tasks(all_generated_tasks, FINAL_TASKS_FILE)
            print(f"最终任务数：{final_count}")
            print(f"保存位置：{FINAL_TASKS_FILE}")
            
            print("\n✅ 任务生成完成！")
        else:
            print("\n❌ 未生成任何任务")
            
    except Exception as e:
        print(f"脚本执行出错：{e}")
    finally:
        # 清理临时目录
        try:
            shutil.rmtree(temp_dir)
            print(f"\n清理临时目录：{temp_dir}")
        except Exception as e:
            print(f"清理临时目录失败：{e}")

if __name__ == "__main__":
    main()