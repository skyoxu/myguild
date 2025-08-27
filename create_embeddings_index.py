#!/usr/bin/env python3
import os
import json
from pathlib import Path
import hashlib

def create_embeddings_index(source_dir='docs/prd_chunks', index_file='prd_chunks.index'):
    """
    创建嵌入索引文件，用于向量数据库或RAG系统
    """
    
    # 获取所有markdown文件
    source_path = Path(source_dir)
    md_files = sorted([f for f in source_path.glob('*.md') if not f.name.endswith('_index.md')])
    
    # 创建索引数据结构
    index_data = {
        "version": "1.0",
        "source_directory": source_dir,
        "total_documents": len(md_files),
        "metadata": {
            "created_at": "2025-08-06",
            "document_type": "PRD",
            "project": "Guild Manager",
            "chunking_method": "section-aware",
            "chunk_size": 8000
        },
        "documents": []
    }
    
    # 处理每个文档
    for idx, file_path in enumerate(md_files, 1):
        # 读取文件内容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取元信息（从文件头部的YAML）
        meta_info = {}
        if content.startswith('---'):
            meta_end = content.find('---', 3)
            if meta_end > 0:
                meta_section = content[3:meta_end].strip()
                for line in meta_section.split('\n'):
                    if ':' in line:
                        key, value = line.split(':', 1)
                        meta_info[key.strip()] = value.strip()
                
                # 获取实际内容（去除元信息）
                actual_content = content[meta_end+3:].strip()
        else:
            actual_content = content
        
        # 生成文档ID（基于文件名的哈希）
        doc_id = hashlib.md5(file_path.name.encode()).hexdigest()[:12]
        
        # 提取第一个标题作为文档标题
        title = file_path.stem.replace('_', ' ').title()
        lines = actual_content.split('\n')
        for line in lines[:10]:  # 只看前10行
            if line.strip().startswith('#'):
                title = line.strip('#').strip()
                break
        
        # 创建文档条目
        doc_entry = {
            "id": doc_id,
            "file": str(file_path.relative_to('.')),
            "chunk_number": idx,
            "title": title,
            "size": len(actual_content),
            "char_count": len(actual_content),
            "line_count": len(actual_content.split('\n')),
            "metadata": meta_info,
            "tags": extract_tags(actual_content),
            "summary": extract_summary(actual_content)
        }
        
        index_data["documents"].append(doc_entry)
        print(f"[{idx}/{len(md_files)}] Indexed: {file_path.name}")
    
    # 写入索引文件
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n[SUCCESS] Index created: {index_file}")
    print(f"[INFO] Total documents indexed: {len(md_files)}")
    
    # 创建一个简化的文本索引
    text_index_file = index_file.replace('.index', '_text.index')
    with open(text_index_file, 'w', encoding='utf-8') as f:
        f.write("# PRD Chunks Embedding Index\n\n")
        f.write(f"Total Documents: {len(md_files)}\n")
        f.write(f"Source Directory: {source_dir}\n\n")
        f.write("## Document List\n\n")
        
        for doc in index_data["documents"]:
            f.write(f"### [{doc['id']}] {doc['title']}\n")
            f.write(f"- File: {doc['file']}\n")
            f.write(f"- Size: {doc['size']} chars\n")
            f.write(f"- Tags: {', '.join(doc['tags'])}\n")
            f.write(f"- Summary: {doc['summary']}\n\n")
    
    print(f"[INFO] Text index created: {text_index_file}")
    
    return index_data

def extract_tags(content):
    """
    从内容中提取关键标签
    """
    tags = []
    
    # 检查常见的PRD关键词
    keywords = {
        'API': ['API', 'REST', 'GraphQL', 'endpoint'],
        'Database': ['数据库', 'database', 'schema', '表结构'],
        'UI': ['界面', 'UI', 'UX', '用户体验', 'frontend'],
        'Backend': ['后端', 'backend', 'server', '服务端'],
        'Auth': ['认证', 'auth', '权限', 'permission'],
        'Game': ['游戏', 'game', '玩法', 'gameplay'],
        'Guild': ['公会', 'guild', '团队', 'team'],
        'Player': ['玩家', 'player', '用户', 'user'],
        'Battle': ['战斗', 'battle', 'combat', 'PvP'],
        'Economy': ['经济', 'economy', '货币', 'currency']
    }
    
    content_lower = content.lower()
    for tag, terms in keywords.items():
        if any(term.lower() in content_lower for term in terms):
            tags.append(tag)
    
    return tags[:5]  # 最多返回5个标签

def extract_summary(content, max_length=200):
    """
    提取内容摘要
    """
    # 跳过空行和标题行
    lines = []
    for line in content.split('\n'):
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('---'):
            lines.append(line)
            if len(' '.join(lines)) > max_length:
                break
    
    summary = ' '.join(lines)[:max_length]
    if len(summary) == max_length:
        summary = summary.rsplit(' ', 1)[0] + '...'
    
    return summary if summary else "No summary available"

if __name__ == "__main__":
    # 创建嵌入索引
    index_data = create_embeddings_index(
        source_dir='docs/prd_chunks',
        index_file='prd_chunks.index'
    )