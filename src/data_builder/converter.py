# Path: src/data_builder/converter.py
import re
import json
import glob
import os
import logging
from typing import List, Optional
from pydantic import BaseModel

from src.config.constants import RULE_24_IDENTIFIER, RULE_PATTERN_REGEX, TITLE_MATCH_REGEX

logger = logging.getLogger(__name__)

class Segment(BaseModel):
    id: int
    text: str
    html: str
    is_rule_start: bool = False
    rule_label: Optional[str] = None

class Section(BaseModel):
    heading: str
    level: int
    rule_no: str
    segments: List[Segment]

class Content(BaseModel):
    title: str
    sections: List[Section]

class DataBuilder:
    def __init__(self, input_pattern: str, output_path: str):
        self.input_pattern = input_pattern
        self.output_path = output_path

    def clean_text(self, text: str) -> str:
        """Làm sạch văn bản khỏi các ký hiệu thừa và chú thích."""
        cleaned: str = re.sub(r'\[\^.*?\]', '', text)
        cleaned = re.sub(r'\(\*\*.*?\*\*\)\*\*\^.*?\^\*\*', '', cleaned) 
        cleaned = re.sub(r'\*\*\^.*?\^\*\*', '', cleaned) 
        cleaned = re.sub(r'\[.*?\]', '', cleaned) 
        
        cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', cleaned)
        cleaned = re.sub(r'\*(.*?)\*', r'\1', cleaned)
        
        cleaned = cleaned.replace(r'\.', '.')
        
        if re.match(r'^[\s\*]+$', cleaned):
            return ""

        return cleaned.strip()

    def split_into_sentences(self, text: str) -> List[str]:
        """Chia văn bản thành các câu dựa trên dấu câu."""
        if not text:
            return []
        if "Sādhu! Sādhu!! Sādhu!!!" in text:
            return [text]

        sentences: List[str] = re.split(r'(?<=[.?!])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def segment_sentence(self, sentence: str) -> List[str]:
        """Tách câu dựa trên dấu nháy đơn."""
        s: str = re.sub(r"(\s|^)'", r"\1<SPLIT>'", sentence)
        s = re.sub(r"'(?=[\s.,;:]|$)", r"'<SPLIT>", s)
        parts: List[str] = s.split("<SPLIT>")
        return [p.strip() for p in parts if p.strip()]

    def format_segment(self, text: str) -> str:
        """Nếu đoạn văn bản in hoa toàn bộ, chuyển thành viết hoa chữ cái đầu của mỗi từ (Title Case)."""
        if text.isupper():
            return text.title()
        return text

    def process_file(self, filepath: str) -> None:
        logger.info(f"Đang xử lý file: {filepath}")
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                text_content: str = f.read()
        except FileNotFoundError:
            logger.error(f"Không tìm thấy file: {filepath}")
            return

        # Extract Title
        title_match = re.search(TITLE_MATCH_REGEX, text_content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else "Giới bổn Tỳ kheo"
        
        # Remove Metadata and decorative lines
        text_content = re.sub(r'^---\n.*?\n---\n', '', text_content, flags=re.DOTALL)
        text_content = re.sub(r'^\s*\*\*\*\s*$', '', text_content, flags=re.MULTILINE)
        text_content = re.sub(r'^\s*\\\*\\\*\\\*\s*$', '', text_content, flags=re.MULTILINE)
        text_content = re.sub(r'^\s*(\*)+\s*$', '', text_content, flags=re.MULTILINE)
            
        paragraphs: List[str] = re.split(r'\n\s*\n', text_content)
        
        sections: List[Section] = []
        current_section: Optional[Section] = None
        current_segments: List[Segment] = []
        current_main_section: str = ""
        global_counter: int = 1
        
        started_content = False
        
        def start_new_section(heading: str, level: int = 1, rule_no: str = ""):
            nonlocal current_section, current_segments
            if current_section:
                current_section.segments = current_segments
                sections.append(current_section)
                logger.debug(f"Completed section: {current_section.heading} with {len(current_segments)} segments")
            
            current_section = Section(heading=heading, level=level, rule_no=rule_no, segments=[])
            current_segments = []

        rule_pattern: re.Pattern = re.compile(RULE_PATTERN_REGEX, re.DOTALL)
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            # Check for Heading
            is_heading = paragraph.startswith('#')
            heading_text = ""
            level = 1
            if is_heading:
                level_match = re.match(r'^(#+)', paragraph)
                level = len(level_match.group(1))
                heading_text = paragraph.lstrip('#').strip()
                heading_text = self.clean_text(heading_text)
                if level == 1:
                    current_main_section = heading_text

            # --- STARTUP LOGIC ---
            if not started_content:
                if is_heading and heading_text == "MỞ ĐẦU":
                    started_content = True
                    start_new_section(heading_text, level=level)
                    continue
                else:
                    continue
            # ---------------------

            if is_heading:
                start_new_section(heading_text, level=level)
                continue

            match = rule_pattern.match(paragraph)
            current_rule_no = ""
            if match:
                current_rule_no = match.group(1)
                text_to_process: str = match.group(2)
                
                # Start a new section for the rule (Level 3)
                # User wants the rule number as the heading
                start_new_section(heading=current_rule_no, level=3, rule_no=current_rule_no)
            else:
                text_to_process = paragraph
            
            cleaned_text_check: str = self.clean_text(text_to_process)
            
            # Special case for Rule 24
            if RULE_24_IDENTIFIER in cleaned_text_check:
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
                    
                    current_segments.append(Segment(
                        id=global_counter,
                        text=self.format_segment(seg),
                        html=html_tmpl.format(self.format_segment(seg))
                    ))
                    global_counter += 1
                continue 

            lines: List[str] = text_to_process.split('\n')
            num_lines: int = len(lines)
            
            for i, line in enumerate(lines):
                cleaned_line: str = self.clean_text(line)
                if not cleaned_line:
                    continue
                
                is_sadhu: bool = "Sādhu! Sādhu!! Sādhu!!!" in cleaned_line
                is_namo: bool = "NAMO TASSA BHAGAVATO ARAHATO SAMMĀSAMBUDDHASSA" in cleaned_line
                is_sekhiya: bool = current_main_section == "THUYẾT GIỚI ƯNG HỌC PHÁP"
                
                line_segments: List[str] = []
                if is_sekhiya or is_sadhu or is_namo:
                    sentences: List[str] = self.split_into_sentences(cleaned_line)
                    line_segments = sentences
                else:
                    sentences = self.split_into_sentences(cleaned_line)
                    for sentence in sentences:
                        segs: List[str] = self.segment_sentence(sentence)
                        line_segments.extend(segs)
                
                num_segs: int = len(line_segments)
                
                for j, seg in enumerate(line_segments):
                    is_para_start_seg: bool = (i == 0 and j == 0)
                    is_line_end: bool = (j == num_segs - 1)
                    is_para_end_seg: bool = (i == num_lines - 1 and j == num_segs - 1)
                    
                    display_text = self.format_segment(seg)
                    
                    is_rule_start = False
                    rule_label = None
                    
                    # Identify if this is the start of a rule
                    if match and i == 0 and j == 0 and current_rule_no:
                        is_rule_start = True
                        rule_label = current_rule_no
                        display_text_html = f"<b>{current_rule_no}.</b> {display_text}"
                    else:
                        display_text_html = display_text

                    prefix_seg: str = "<p>" if is_para_start_seg else ""
                    
                    if is_para_end_seg:
                        suffix_seg: str = "</p>"
                    elif is_line_end:
                        suffix_seg = "<br>"
                    else:
                        suffix_seg = " "
                    
                    html_tmpl = f"{prefix_seg}{{}}{suffix_seg}"
                    
                    current_segments.append(Segment(
                        id=global_counter,
                        text=display_text, # Clean text for TTS
                        html=html_tmpl.format(display_text_html), # Text with rule number for display
                        is_rule_start=is_rule_start,
                        rule_label=rule_label
                    ))
                    global_counter += 1

        # Append the last section
        if current_section:
            current_section.segments = current_segments
            sections.append(current_section)
            logger.debug(f"Completed last section: {current_section.heading} with {len(current_segments)} segments")
            
        content = Content(title=title, sections=sections)
        
        os.makedirs(os.path.dirname(self.output_path), exist_ok=True)
        with open(self.output_path, 'w', encoding='utf-8') as f:
            f.write(content.model_dump_json(indent=2))
                
        logger.info(f"✅ Đã chuyển đổi thành công {filepath} sang {self.output_path}")

    def run(self) -> None:
        files: List[str] = glob.glob(self.input_pattern)
        if files:
            self.process_file(files[0])
        else:
            logger.warning(f"⚠️ Không tìm thấy file markdown nào khớp với pattern: {self.input_pattern}")
