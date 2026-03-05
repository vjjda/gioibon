# Path: src/data_builder/tsv_processor.py
import csv
import logging
import re
from typing import List, Dict, Any

from src.data_builder.models import SegmentData
from src.data_builder.tts_generator import TTSGenerator

logger = logging.getLogger(__name__)

__all__ = ["TsvContentProcessor"]

class TsvContentProcessor:
    def __init__(self, tts_generator: TTSGenerator):
        self.tts_generator = tts_generator

    def _generate_hint_html(self, text: str) -> str:
        """Bọc phần đuôi của các từ vào thẻ span.hint-tail để dùng cho Hint Mode."""
        if not text:
            return ""

        # Regex này khớp với: (Phụ âm đầu hoặc Chữ cái đầu) (Các chữ cái tiếp theo)
        pattern = r"\b(ngh|ch|gh|gi|kh|ng|nh|ph|qu|th|tr|[^\W\d_])([^\W\d_]+)"

        # Split text by HTML tags to preserve them, ensuring we don't inject spans inside HTML attributes
        parts = re.split(r'(<[^>]+>)', text)
        result = []
        for part in parts:
            if part.startswith('<') and part.endswith('>'):
                result.append(part)
            else:
                result.append(re.sub(pattern, r"\1<span class='hint-tail'>\2</span>", part, flags=re.IGNORECASE | re.UNICODE))

        return "".join(result)

    def _process_selections(self, text: str) -> str:
        """Xử lý các đoạn lựa chọn trong ngoặc vuông [...hoặc...]"""
        if '[' not in text:
            return text

        # 1. Tìm tất cả các cụm ngoặc vuông và dấu câu theo sau ngay lập tức
        groups = []
        # Regex tìm: [nội dung] + các dấu câu bám sau
        pattern = r'\[(.*?)\]([.,;!:\?]*)'
        for match in re.finditer(pattern, text):
            content = match.group(1).strip()
            suffix = match.group(2) # Dấu câu bám đuôi (nếu có)
            
            items = []
            if content.startswith("hoặc"):
                items = re.split(r',\s*(?=hoặc)', content)
            elif " hoặc " in content:
                items = content.split(" hoặc ")
            else:
                items = [content]
            
            # Nếu có dấu câu bám đuôi, gắn nó vào item cuối cùng của cụm
            if items and suffix:
                items[-1] = items[-1].strip() + suffix
            
            groups.append({
                'content': content,
                'items': items,
                'start': match.start(),
                'end': match.end(),
                'suffix': suffix
            })

        if not groups:
            return text

        # 2. Xác định các cụm cần được "stacked" (có chính xác 2 items và đứng cạnh nhau)
        for i, g in enumerate(groups):
            g['is_block'] = len(g['items']) >= 3
            g['is_stacked'] = False
            
            if len(g['items']) == 2:
                # Kiểm tra cụm phía trước (chỉ tính nếu khoảng cách giữa chúng chỉ có whitespace)
                if i > 0:
                    prev_g = groups[i-1]
                    if len(prev_g['items']) == 2:
                        between = text[prev_g['end']:g['start']]
                        if between.strip() == "":
                            g['is_stacked'] = True
                            prev_g['is_stacked'] = True
                
                # Kiểm tra cụm phía sau
                if i < len(groups) - 1:
                    next_g = groups[i+1]
                    if len(next_g['items']) == 2:
                        between = text[g['end']:next_g['start']]
                        if between.strip() == "":
                            g['is_stacked'] = True
                            next_g['is_stacked'] = True

        # 3. Thực hiện thay thế từ cuối lên đầu
        result = text
        for g in reversed(groups):
            is_block = g['is_block']
            is_stacked = g['is_stacked']
            should_wrap = is_block or is_stacked
            
            items = g['items']
            content = g['content']
            
            processed_parts = []
            if content.startswith("hoặc"):
                for p in items:
                    p = p.strip()
                    m = re.match(r'^(hoặc là|hoặc)\s*(.*)$', p)
                    if m:
                        inner_html = f"<span class='selection-or'>{m.group(1)}</span> <span class='selection-item'>{m.group(2)}</span>"
                    else:
                        inner_html = f"<span class='selection-item'>{p}</span>"
                    
                    if should_wrap:
                        processed_parts.append(f"<div class='selection-row'>{inner_html}</div>")
                    else:
                        processed_parts.append(inner_html)
            elif " hoặc " in content:
                # Lưu ý: items[-1] có thể đã chứa suffix (dấu câu)
                for idx, p in enumerate(items):
                    item_text = p.strip()
                    item_html = f"<span class='selection-item'>{item_text}</span>"
                    if idx == 0:
                        inner_html = item_html
                    else:
                        inner_html = f"<span class='selection-or'>hoặc</span> {item_html}"
                    
                    if should_wrap:
                        processed_parts.append(f"<div class='selection-row'>{inner_html}</div>")
                    else:
                        processed_parts.append(inner_html)
            else:
                # items[0] chứa content + suffix
                processed_parts = [f"<span class='selection-item'>{items[0]}</span>"]

            sep = "" if should_wrap else (", " if content.startswith("hoặc") else " ")
            inner_content = sep.join(processed_parts)
            
            tag = "div" if should_wrap else "span"
            classes = ["selection-group"]
            if is_block:
                classes.append("is-block")
            elif is_stacked:
                classes.append("is-stacked")
            
            replacement = f"<{tag} class='{' '.join(classes)}'>{inner_content}</{tag}>"
            result = result[:g['start']] + replacement + result[g['end']:]

        return result

    def _process_duyenco(self, text: str) -> str:
        """Xử lý định dạng danh sách duyenco."""
        # Tách các thành phần bằng dấu chấm phẩy
        parts = [p.strip() for p in text.split(';') if p.strip()]
        if not parts:
            return text

        if len(parts) == 1:
            # Trường hợp 1 item: bọc span bảo vệ để tránh flex-gap làm gãy từ khi có hint spans
            content = f"<ul class='duyenco-list single-item'><li><span class='duyenco-content'>{parts[0]}</span></li></ul>"
        else:
            # Trường hợp nhiều items: dùng ol, mỗi item bọc trong span.duyenco-content
            list_items = "".join([f"<li><span class='duyenco-content'>{p}</span></li>" for p in parts])
            content = f"<ol class='duyenco-list multi-item'>{list_items}</ol>"

        return content

    def process_tsv(self, tsv_path: str) -> List[SegmentData]:
        """Đọc file TSV nguồn và bổ sung cột Audio, segment_html bằng cách xử lý text."""
        segments_output: List[SegmentData] = []

        try:
            with open(tsv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter='\t')

                rows = list(reader)
                total = len(rows)
                logger.info(f"Đang xử lý {total} segments từ {tsv_path}...")

                in_quote = False

                for i, row in enumerate(rows):
                    uid = i + 1
                    html = row['html']
                    label = row['label']
                    raw_source_text = row['segment']

                    # --- 1. Xử lý quote wrapping (Duy trì trạng thái in_quote) ---
                    was_in_quote = in_quote
                    text_with_quotes = ""

                    for char in raw_source_text:
                        if char == '‘':
                            if not in_quote:
                                text_with_quotes += "<span class='quote-text'>"
                                in_quote = True
                            text_with_quotes += '‘'
                        elif char == '’':
                            text_with_quotes += '’'
                            if in_quote:
                                text_with_quotes += "</span>"
                                in_quote = False
                        else:
                            text_with_quotes += char

                    if was_in_quote:
                        text_with_quotes = "<span class='quote-text'>" + text_with_quotes
                    if in_quote:
                        text_with_quotes = text_with_quotes + "</span>"

                    # --- 2. Xác định các flag hiển thị ---
                    is_heading = html.startswith("<h") or label in ["title", "subtitle"] or label.endswith("-name") or label.endswith("-chapter")

                    # --- 3. Tạo segment_html (Làm giàu nội dung hiển thị) ---
                    current_display_text = text_with_quotes
                    has_hint_val = 0

                    if is_heading:
                        # Chỉ bọc Pali trong ngoặc đơn cho heading (Giữ nguyên dấu ngoặc)
                        if (html.startswith("<h") or label.endswith("-chapter")) and label.endswith("-name") or label.endswith("-chapter"):
                            pali_pattern = r"\(.*?\)"
                            current_display_text = re.sub(pali_pattern, r"<span class='pali-name'>\g<0></span>", current_display_text)
                    else:
                        # A. Xử lý phần bổ sung của dịch giả (Bỏ dấu ngoặc đơn, bọc thẻ trans-addition)
                        trans_pattern = r"\((.*?)\)"
                        current_display_text = re.sub(trans_pattern, r"<span class='trans-addition'>\1</span>", current_display_text)

                        # B. Xử lý phần lựa chọn [hoặc] (Bỏ dấu ngoặc vuông, bọc rich styles)
                        current_display_text = self._process_selections(current_display_text)

                        # C. Xử lý duyenco (Danh sách liệt kê)
                        if label.endswith('-duyenco'):
                            current_display_text = self._process_duyenco(current_display_text)
                            # Đổi template p -> div để HTML valid vì p không được chứa ul/ol
                            if html.startswith("<p"):
                                html = html.replace("<p", "<div").replace("</p>", "</div>")

                        # D. Tạo Hint cho nội dung thường
                        current_display_text = self._generate_hint_html(current_display_text)
                        has_hint_val = 1

                    # --- 4. Tạo segment (Văn bản thuần túy để tìm kiếm) ---
                    # Bỏ mọi loại ngoặc ( , ) , [ , ] ở bản thô
                    clean_segment = re.sub(r'\(|\)|\[|\]', '', raw_source_text)
                    # Loại bỏ hoàn toàn thẻ HTML nếu có
                    clean_segment = re.sub(r'<[^>]+>', '', clean_segment)

                    # 5. Tạo tên file audio
                    audio_filename = self.tts_generator.process_segment(
                        segment_text=clean_segment, # Dùng bản sạch để TTS
                        html=html,
                        label=label
                    )

                    segments_output.append(SegmentData(
                        uid=uid,
                        html=html,
                        label=label,
                        segment=clean_segment,
                        audio=audio_filename,
                        segment_html=current_display_text,
                        has_hint=has_hint_val
                    ))

                    if (i + 1) % 200 == 0:
                        logger.info(f"Đã xử lý {i + 1}/{total} segments...")
        except Exception as e:
            logger.error(f"Lỗi khi xử lý file TSV: {e}")
            raise e

        return segments_output
