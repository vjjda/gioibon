# Path: src/data_builder/processor.py
import re
import logging
from typing import List
from src.config.constants import RULE_24_IDENTIFIER, RULE_PATTERN_REGEX
from src.data_builder.models import SegmentData
from src.data_builder.labeler import ContentLabeler

logger = logging.getLogger(__name__)

class ContentProcessor:
    def __init__(self):
        self.labeler = ContentLabeler()
        self.uid_counter = 1

    def clean_text(self, text: str) -> str:
        # Giữ nguyên logic clean text nhưng không xóa in đậm/nghiêng theo yêu cầu mới
        cleaned = re.sub(r'\[\^.*?\]', '', text) # Xóa chú thích [^1]
        cleaned = re.sub(r'\[.*?\]', '', cleaned) # Xóa 
        cleaned = cleaned.replace(r'\.', '.')
        return cleaned.strip()

    def split_sentences(self, text: str) -> List[str]:
        if "Sādhu!" in text: return [text]
        # Tách theo dấu kết thúc câu
        sentences = re.split(r'(?<=[.?!])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def process_content(self, raw_md: str) -> List[SegmentData]:
        segments_output = []
        # Loại bỏ metadata đầu file
        content = re.sub(r'^---.*?---', '', raw_md, flags=re.DOTALL)
        paragraphs = re.split(r'\n\s*\n', content)
        
        rule_pattern = re.compile(RULE_PATTERN_REGEX, re.DOTALL)

        for para in paragraphs:
            para = para.strip()
            if not para: continue

            # Xử lý Headings
            if para.startswith('#'):
                level_match = re.match(r'^(#+)', para)
                level = len(level_match.group(1))
                text = para.lstrip('#').strip()
                self.labeler.update_context(text, level)
                
                label = self.labeler.get_label()
                tmpl = f"<h{level}>{{}}</h{level}>"
                segments_output.append(SegmentData(
                    uid=self.uid_counter, html=tmpl, label=label, segment=text
                ))
                self.uid_counter += 1
                continue

            # Xử lý Rule (1. , 2. ...)
            match = rule_pattern.match(para)
            if match:
                rule_no = match.group(1)
                text_to_process = match.group(2)
                label = self.labeler.get_label(is_rule=True, rule_no=rule_no)
            else:
                text_to_process = para
                label = self.labeler.get_label()

            # Xử lý đặc biệt Rule 24
            if RULE_24_IDENTIFIER in text_to_process:
                # Chia nhỏ theo yêu cầu Rule 24 (tương tự converter cũ)
                sub_parts = [
                    "(Biết rằng): 'Mùa nóng còn lại là một tháng' vị tỳ khưu nên tìm kiếm y choàng tắm mưa.",
                    "(Biết rằng): 'Mùa nóng còn lại là nửa tháng' vị làm xong thì nên mặc.",
                    "Nếu (biết rằng): 'Mùa nóng còn lại là hơn một tháng' rồi tìm kiếm y choàng tắm mưa,",
                    "(nếu biết rằng): 'Mùa nóng còn lại là hơn nửa tháng' sau khi làm xong rồi mặc vào thì (y ấy) nên được xả bỏ và (vị ấy) phạm tội pācittiya."
                ]
                for i, s in enumerate(sub_parts):
                    prefix = "<p>" if i == 0 else ""
                    suffix = "</p>" if i == len(sub_parts)-1 else "<br>"
                    segments_output.append(SegmentData(
                        uid=self.uid_counter, html=f"{prefix}{{}}{suffix}", label=label, segment=s
                    ))
                    self.uid_counter += 1
                continue

            # Xử lý đoạn văn thường
            lines = text_to_process.split('\n')
            for i, line in enumerate(lines):
                clean_l = self.clean_text(line)
                if not clean_l: continue
                
                # Logic chia nhỏ câu hoặc giữ nguyên tùy theo section (như Sk, Sadhu)
                if any(x in label.lower() for x in ["sk", "nidana", "sadhu"]):
                    sentences = [clean_l] # Giữ nguyên dòng
                else:
                    sentences = self.split_sentences(clean_l)

                for j, sent in enumerate(sentences):
                    # Tạo template HTML
                    prefix = "<p>" if (i == 0 and j == 0) else ""
                    suffix = "</p>" if (i == len(lines)-1 and j == len(sentences)-1) else " "
                    if j == len(sentences)-1 and i < len(lines)-1: suffix = "<br>"
                    
                    segments_output.append(SegmentData(
                        uid=self.uid_counter, html=f"{prefix}{{}}{suffix}", label=label, segment=sent
                    ))
                    self.uid_counter += 1

        return segments_output