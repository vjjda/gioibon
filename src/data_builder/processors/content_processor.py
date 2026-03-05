# Path: src/data_builder/processors/content_processor.py
import csv
import logging
from typing import List

from src.data_builder.models import SegmentData
from src.data_builder.tts_generator import TTSGenerator
from src.data_builder.processors.base import strip_html_tags, clean_brackets
from src.data_builder.processors.quote_processor import QuoteStateProcessor
from src.data_builder.processors.addition_processor import AdditionProcessor
from src.data_builder.processors.selection_processor import SelectionProcessor
from src.data_builder.processors.list_processor import ListProcessor
from src.data_builder.processors.hint_processor import HintProcessor

from src.data_builder.processors.structure_processor import StructureProcessor

logger = logging.getLogger(__name__)

__all__ = ["TsvContentProcessor"]

class TsvContentProcessor:
    """Bộ điều phối chính để xử lý file TSV thành dữ liệu phong phú."""
    
    def __init__(self, tts_generator: TTSGenerator, rule_groups_path: str = "data/content/rule_groups.tsv"):
        self.tts_generator = tts_generator
        # Khởi tạo các sub-processors
        self.quote_proc = QuoteStateProcessor()
        self.addition_proc = AdditionProcessor()
        self.selection_proc = SelectionProcessor()
        self.list_proc = ListProcessor()
        self.hint_proc = HintProcessor()
        self.structure_proc = StructureProcessor(rule_groups_path)

    def process_tsv(self, tsv_path: str):
        """Đọc file TSV nguồn và bổ sung cột Audio, segment_html bằng cách điều phối các bộ xử lý nhỏ."""
        segments_output: List[SegmentData] = []
        
        try:
            with open(tsv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter='\t')
                rows = list(reader)
                total = len(rows)
                logger.info(f"Đang xử lý {total} segments từ {tsv_path}...")

                for i, row in enumerate(rows):
                    uid = i + 1
                    html_template = row['html']
                    label = row['label']
                    raw_source_text = row['segment']

                    # Trích xuất cấu trúc phân cấp (Heading/Rule)
                    heading_id, rule_id = self.structure_proc.process_segment(uid, html_template, label, raw_source_text)

                    # 1. Xử lý Trích dẫn (Quote) - Cần duy trì state nên chạy đầu tiên
                    current_display_text = self.quote_proc.process(raw_source_text)

                    # 2. Xác định các flag hiển thị
                    is_heading = html_template.startswith("<h") or label in ["title", "subtitle"] or label.endswith("-name") or label.endswith("-chapter")
                    
                    # 3. Làm giàu nội dung hiển thị (Rich Text)
                    has_hint_val = 0
                    if is_heading:
                        current_display_text = self.addition_proc.process(current_display_text, True, label, html_template)
                    else:
                        # Thứ tự: Bổ sung của dịch giả -> Lựa chọn [hoặc] -> Danh sách duyenco -> Hint
                        current_display_text = self.addition_proc.process(current_display_text, False, label, html_template)
                        current_display_text = self.selection_proc.process(current_display_text)
                        
                        if label.endswith('-duyenco'):
                            current_display_text = self.list_proc.process_duyenco(current_display_text)
                        
                        # Chuẩn hoá HTML template nếu cần (p -> div)
                        html_template = self.list_proc.ensure_valid_html(html_template, current_display_text)
                        
                        # Tạo Hint (Chạy cuối cùng để bọc cả các thẻ span đã tạo trước đó nếu cần)
                        current_display_text = self.hint_proc.process(current_display_text)
                        has_hint_val = 1

                    # 4. Tạo bản sạch (Raw Text) để Tìm kiếm & TTS
                    clean_segment = clean_brackets(raw_source_text)
                    clean_segment = strip_html_tags(clean_segment)

                    # 5. Tạo Audio
                    audio_filename = self.tts_generator.process_segment(
                        segment_text=clean_segment,
                        html=html_template,
                        label=label
                    )
                    
                    segments_output.append(SegmentData(
                        uid=uid,
                        html=html_template,
                        label=label,
                        segment=clean_segment,
                        audio=audio_filename,
                        segment_html=current_display_text,
                        has_hint=has_hint_val,
                        heading_id=heading_id,
                        rule_id=rule_id
                    ))
                    
                    if (i + 1) % 200 == 0:
                        logger.info(f"Đã xử lý {i + 1}/{total} segments...")

        except Exception as e:
            logger.error(f"Lỗi khi xử lý file TSV: {e}")
            raise e

        return segments_output, self.structure_proc.get_rules(), self.structure_proc.get_headings()
