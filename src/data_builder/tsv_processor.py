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
                        # Chỉ bọc Pali trong ngoặc đơn cho heading
                        if html.startswith("<h") and label.endswith("-name"):
                            pali_pattern = r"\(.*?\)"
                            current_display_text = re.sub(pali_pattern, r"<span class='pali-name'>\g<0></span>", current_display_text)
                    else:
                        # Tạo Hint cho nội dung thường
                        current_display_text = self._generate_hint_html(current_display_text)
                        has_hint_val = 1

                    # --- 4. Tạo segment (Văn bản thuần túy để tìm kiếm) ---
                    # Loại bỏ hoàn toàn thẻ HTML khỏi segment_text
                    # Lưu ý: Dùng raw_source_text để đảm bảo không dính các span vừa thêm
                    clean_segment = re.sub(r'<[^>]+>', '', raw_source_text)

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
