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
        # Hỗ trợ các phụ âm ghép tiếng Việt (ngh, ch, gh, gi, kh, ng, nh, ph, qu, th, tr)
        # Sử dụng re.IGNORECASE để khớp cả chữ hoa và thường.
        # [^\W\d_] khớp với ký tự là chữ (Letter), không bao gồm số và dấu gạch dưới.
        pattern = r"\b(ngh|ch|gh|gi|kh|ng|nh|ph|qu|th|tr|[^\W\d_])([^\W\d_]+)"
        return re.sub(pattern, r"\1<span class='hint-tail'>\2</span>", text, flags=re.IGNORECASE | re.UNICODE)

    def process_tsv(self, tsv_path: str) -> List[SegmentData]:
        """Đọc file TSV nguồn và bổ sung cột Audio, cột Hint bằng cách xử lý text."""
        segments_output: List[SegmentData] = []
        
        try:
            with open(tsv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter='	')
                
                rows = list(reader)
                total = len(rows)
                logger.info(f"Đang xử lý {total} segments từ {tsv_path}...")

                for i, row in enumerate(rows):
                    uid = i + 1
                    html = row['html']
                    label = row['label']
                    segment_text = row['segment']

                    # 1. Tạo nội dung cho Hint Mode (Pre-processed)
                    # Bỏ qua tạo hint-tail cho các đoạn là heading (luôn hiển thị rõ)
                    is_heading = html.startswith("<h") or label in ["title", "subtitle"] or label.endswith("-name") or label.endswith("-chapter")
                    
                    if is_heading:
                        hint_content = ""
                        # Chỉ bọc các cụm từ trong ngoặc đơn (Pali) vào thẻ span.pali-name cho heading/name
                        if html.startswith("<h") and label.endswith("-name"):
                            pali_pattern = r"\(.*?\)"
                            segment_text = re.sub(pali_pattern, r"<span class='pali-name'>\g<0></span>", segment_text)
                    else:
                        hint_content = self._generate_hint_html(segment_text)

                    # 3. Tạo tên file audio (hash) hoặc skip
                    audio_filename = self.tts_generator.process_segment(
                        segment_text=segment_text,
                        html=html,
                        label=label
                    )
                    
                    segments_output.append(SegmentData(
                        uid=uid,
                        html=html,
                        label=label,
                        segment=segment_text,
                        audio=audio_filename,
                        hint=hint_content
                    ))
                    
                    if (i + 1) % 200 == 0:
                        logger.info(f"Đã xử lý {i + 1}/{total} segments...")

        except Exception as e:
            logger.error(f"Lỗi khi xử lý file TSV: {e}")
            raise e

        return segments_output
