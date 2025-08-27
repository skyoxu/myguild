#!/usr/bin/env python3
import os
import re
from pathlib import Path

def split_markdown_by_sections(file_path, chunk_size=8000, output_dir='docs/prd_chunks'):
    """
    智能拆分Markdown文档，尽量保持章节完整性
    """
    # 创建输出目录
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # 读取文档
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 按标题分割文档
    sections = []
    current_section = []
    current_size = 0
    
    lines = content.split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # 检测标题行（# 开头）
        is_header = line.strip().startswith('#')
        
        # 如果是主要标题（1-3级）且当前块已经很大，则开始新块
        if is_header and re.match(r'^#{1,3}\s', line) and current_size > chunk_size * 0.7:
            if current_section:
                sections.append('\n'.join(current_section))
                current_section = []
                current_size = 0
        
        # 添加当前行
        current_section.append(line)
        current_size += len(line) + 1
        
        # 如果超过chunk_size，在合适的位置分割
        if current_size > chunk_size:
            # 尝试在段落结束处分割
            split_point = len(current_section)
            for j in range(len(current_section) - 1, max(len(current_section) - 20, 0), -1):
                if current_section[j].strip() == '' and j > 0:
                    split_point = j
                    break
            
            # 保存当前块
            sections.append('\n'.join(current_section[:split_point]))
            
            # 剩余部分作为新块的开始
            current_section = current_section[split_point:]
            current_size = sum(len(line) + 1 for line in current_section)
        
        i += 1
    
    # 保存最后一个块
    if current_section:
        sections.append('\n'.join(current_section))
    
    # 写入文件
    base_name = Path(file_path).stem
    for idx, section in enumerate(sections, 1):
        output_file = Path(output_dir) / f"{base_name}_chunk_{idx:03d}.md"
        with open(output_file, 'w', encoding='utf-8') as f:
            # 添加元信息头部
            f.write(f"---\n")
            f.write(f"source: {file_path}\n")
            f.write(f"chunk: {idx}/{len(sections)}\n")
            f.write(f"size: {len(section)} chars\n")
            f.write(f"---\n\n")
            f.write(section)
        
        print(f"[OK] Created: {output_file} ({len(section)} chars)")
    
    # 创建索引文件
    index_file = Path(output_dir) / f"{base_name}_index.md"
    with open(index_file, 'w', encoding='utf-8') as f:
        f.write(f"# {base_name} Document Chunks Index\n\n")
        f.write(f"Total chunks: {len(sections)}\n")
        f.write(f"Original file: {file_path}\n")
        f.write(f"Chunk size: ~{chunk_size} chars\n\n")
        f.write("## Chunks List\n\n")
        
        for idx in range(1, len(sections) + 1):
            chunk_file = f"{base_name}_chunk_{idx:03d}.md"
            f.write(f"- [{chunk_file}](./{chunk_file})\n")
    
    print(f"\n[INFO] Total chunks created: {len(sections)}")
    print(f"[INFO] Index file: {index_file}")
    
    return len(sections)

if __name__ == "__main__":
    # 执行拆分
    num_chunks = split_markdown_by_sections(
        'PRD-Guild-Manager.md',
        chunk_size=8000,
        output_dir='docs/prd_chunks'
    )