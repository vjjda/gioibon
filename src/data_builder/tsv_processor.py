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

        def replacer(match):
            content = match.group(1).strip()

            # 1. Trường hợp danh sách các cụm "hoặc là ..." hoặc "hoặc ..." ở đầu mỗi cụm (ngăn cách bởi dấu phẩy)
            # VD: [hoặc là với tội A, hoặc là với tội B]
            if content.startswith("hoặc"):
                # Tách theo dấu phẩy, dùng lookahead để đảm bảo vế sau cũng bắt đầu bằng "hoặc"
                parts = re.split(r',\s*(?=hoặc)', content)
                processed_parts = []
                for p in parts:
                    p = p.strip()
                    # Tách từ khóa ở đầu cụm (ưu tiên "hoặc là" dài hơn trước)
                    m = re.match(r'^(hoặc là|hoặc)\s*(.*)$', p)
                    if m:
                        processed_parts.append(f"<span class='selection-or'>{m.group(1)}</span> <span class='selection-item'>{m.group(2)}</span>")
                    else:
                        processed_parts.append(f"<span class='selection-item'>{p}</span>")
                inner = ", ".join(processed_parts)
                return f"<span class='selection-group'>{inner}</span>"

            # 2. Trường hợp "hoặc" nằm ở giữa để phân tách các vế (Phổ biến)
            # VD: [vật thực cứng hoặc vật thực mềm]
            # VD: [là người phụ việc chùa hoặc là nam cư sĩ] -> tách tại " hoặc " -> "là...chùa" và "là nam cư sĩ"
            elif " hoặc " in content:
                # Tách tất cả các vế bằng từ " hoặc " duy nhất làm mốc phân tách
                parts = content.split(" hoặc ")
                wrapped_parts = [f"<span class='selection-item'>{p.strip()}</span>" for p in parts]
                inner = " <span class='selection-or'>hoặc</span> ".join(wrapped_parts)
                return f"<span class='selection-group'>{inner}</span>"

            return content

        return re.sub(r'\[(.*?)\]', replacer, text)
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

                        # C. Tạo Hint cho nội dung thường
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
