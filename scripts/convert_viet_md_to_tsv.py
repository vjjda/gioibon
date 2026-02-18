#!/usr/bin/env python3
# Path: scripts/convert_viet_md_to_tsv.py

import re
import csv
import glob
import os
from typing import List, Optional
from pydantic import BaseModel

__all__ = ["TSVRow", "clean_text", "split_into_sentences", "segment_sentence", "format_segment", "process_file", "main"]

class TSVRow(BaseModel):
    no: int
    html: str
    heading: str
    rule_no: str
    segment: str

def clean_text(text: str) -> str:
    """Làm sạch văn bản khỏi các ký hiệu thừa và chú thích."""
    cleaned: str = re.sub(r'\[\^.*?\]', '', text)
    cleaned = re.sub(r'\(\*\*.*?\*\*\)\*\*\^.*?\^\*\*', '', cleaned) 
    cleaned = re.sub(r'\*\*\^.*?\^\*\*', '', cleaned) 
    cleaned = re.sub(r'\[.*?\]', '', cleaned) 
    
    cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'\*(.*?)\*', r'\1', cleaned)
    
    cleaned = cleaned.replace(r'\.', '.')
    
    if re.match(r'^[\s\\*]+$', cleaned):
        return ""

    return cleaned.strip()

def split_into_sentences(text: str) -> List[str]:
    """Chia văn bản thành các câu dựa trên dấu câu."""
    if not text:
        return []
    if "Sādhu! Sādhu!! Sādhu!!!" in text:
        return [text]

    sentences: List[str] = re.split(r'(?<=[.?!])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

def segment_sentence(sentence: str) -> List[str]:
    """Tách câu dựa trên dấu nháy đơn."""
    s: str = re.sub(r"(\s|^)'", r"\1<SPLIT>'", sentence)
    s = re.sub(r"'(?=[\s.,;:]|$)", r"'<SPLIT>", s)
    parts: List[str] = s.split("<SPLIT>")
    return [p.strip() for p in parts if p.strip()]

def format_segment(text: str) -> str:
    """Nếu đoạn văn bản in hoa toàn bộ, chuyển thành viết hoa chữ cái đầu của mỗi từ (Title Case)."""
    if text.isupper():
        return text.title()
    return text

def process_file(filepath: str) -> None:
    output_path: str = 'output/sentences/viet_patimokkha_segments.tsv'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        text_content: str = f.read()

    text_content = re.sub(r'^---\n.*?\n---\n', '', text_content, flags=re.DOTALL)
    text_content = re.sub(r'^\s*\*\*\*\s*$', '', text_content, flags=re.MULTILINE)
    text_content = re.sub(r'^\s*\\\*\\\*\\\*\s*$', '', text_content, flags=re.MULTILINE)
    text_content = re.sub(r'^\s*(\\\*)+\s*$', '', text_content, flags=re.MULTILINE)
        
    paragraphs: List[str] = re.split(r'\n\s*\n', text_content)
    
    rows: List[TSVRow] = []
    global_counter: int = 1
    current_rule_no: str = ""
    current_heading: str = ""
    current_main_section: str = ""

    rule_24_identifier: str = "(Biết rằng): 'Mùa nóng còn lại là một tháng' vị tỳ khưu nên tìm kiếm y choàng tắm mưa."
    rule_pattern: re.Pattern = re.compile(r'^\s*(\d+)(?:\\|\.)\.\s+(.*)', re.DOTALL)
    
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
            
        if paragraph.startswith('#'):
            level_match = re.match(r'^#+', paragraph)
            level: int = len(level_match.group(0)) if level_match else 1
            heading_text: str = paragraph.lstrip('#').strip()
            cleaned_heading: str = clean_text(heading_text)
            
            current_heading = cleaned_heading
            if level == 1:
                current_main_section = cleaned_heading
              
            current_rule_no = "" 
            
            html_tmpl: str = f"<h{level}>{{}}</h{level}>"
            
            rows.append(TSVRow(
                no=global_counter,
                html=html_tmpl,
                heading=current_heading,
                rule_no="",
                segment=format_segment(current_heading)
            ))
            global_counter += 1
            continue

        match = rule_pattern.match(paragraph)
        if match:
            current_rule_no = match.group(1)
            text_to_process: str = match.group(2)
        else:
            text_to_process = paragraph
        
        cleaned_text_check: str = clean_text(text_to_process)
        if rule_24_identifier in cleaned_text_check:
            segments_24: List[str] = [
                "(Biết rằng): 'Mùa nóng còn lại là một tháng' vị tỳ khưu nên tìm kiếm y choàng tắm mưa.",
                "(Biết rằng): 'Mùa nóng còn lại là nửa tháng' vị làm xong thì nên mặc.",
                "Nếu (biết rằng): 'Mùa nóng còn lại là hơn một tháng' rồi tìm kiếm y choàng tắm mưa,",
                "(nếu biết rằng): 'Mùa nóng còn lại là hơn nửa tháng' sau khi làm xong rồi mặc vào thì (y ấy) nên được xả bỏ và (vị ấy) phạm tội pācittiya."
            ]
            
            for i, seg in enumerate(segments_24):
                is_para_start: bool = (i == 0)
                is_para_end: bool = (i == len(segments_24) - 1)
                
                prefix: str = "<p>" if is_para_start else ""
                suffix: str = "</p>" if is_para_end else " "
                
                html_tmpl = f"{prefix}{{}}{suffix}"
                
                rows.append(TSVRow(
                    no=global_counter,
                    html=html_tmpl,
                    heading=current_heading,
                    rule_no=current_rule_no,
                    segment=format_segment(seg)
                ))
                global_counter += 1
            continue 

        lines: List[str] = text_to_process.split('\n')
        num_lines: int = len(lines)
        
        for i, line in enumerate(lines):
            cleaned_line: str = clean_text(line)
            if not cleaned_line:
                continue
            
            is_sadhu: bool = "Sādhu! Sādhu!! Sādhu!!!" in cleaned_line
            is_sekhiya: bool = current_main_section == "THUYẾT GIỚI ƯNG HỌC PHÁP"
            
            line_segments: List[str] = []
            if is_sekhiya or is_sadhu:
                sentences: List[str] = split_into_sentences(cleaned_line)
                line_segments = sentences
            else:
                sentences = split_into_sentences(cleaned_line)
                for sentence in sentences:
                    segs: List[str] = segment_sentence(sentence)
                    line_segments.extend(segs)
            
            num_segs: int = len(line_segments)
            
            for j, seg in enumerate(line_segments):
                is_para_start_seg: bool = (i == 0 and j == 0)
                is_line_end: bool = (j == num_segs - 1)
                is_para_end_seg: bool = (i == num_lines - 1 and j == num_segs - 1)
                
                prefix_seg: str = "<p>" if is_para_start_seg else ""
                
                if is_para_end_seg:
                    suffix_seg: str = "</p>"
                elif is_line_end:
                    suffix_seg = "<br>"
                else:
                    suffix_seg = " "
                
                html_tmpl = f"{prefix_seg}{{}}{suffix_seg}"
                
                rows.append(TSVRow(
                    no=global_counter,
                    html=html_tmpl,
                    heading=current_heading,
                    rule_no=current_rule_no,
                    segment=format_segment(seg)
                ))
                global_counter += 1
            
    with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames: List[str] = list(TSVRow.model_fields.keys())
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, delimiter='\t')
        
        writer.writeheader()
        for row in rows:
            writer.writerow(row.model_dump())
            
    print(f"✅ Đã chuyển đổi thành công {filepath} sang {output_path}")

def main() -> None:
    files: List[str] = glob.glob('data/Gioi bon Viet/*.md')
    if files:
        process_file(files[0])
    else:
        print("⚠️ Không tìm thấy file markdown nào.")

if __name__ == "__main__":
    main()