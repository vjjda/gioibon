# Path: src/data_builder/processor.py
import re
import logging
from typing import List
from src.config.constants import RULE_24_IDENTIFIER, RULE_PATTERN_REGEX
from src.data_builder.models import SegmentData
from src.data_builder.labeler import ContentLabeler

logger = logging.getLogger(__name__)

__all__ = ["ContentProcessor"]

class ContentProcessor:
    def __init__(self):
        self.labeler = ContentLabeler()
        self.uid_counter = 1
        self.segments_output: List[SegmentData] = []

    def clean_text(self, text: str) -> str:
        # Xóa chú thích dạng footnote [^1], [^2] (nếu có)
        cleaned = re.sub(r'\[\^.*?\]', '', text)
        
        # Đã lược bỏ lệnh re.sub(r'\[.*?\]', '', cleaned) để không xóa nhầm chữ trong ngoặc vuông
        
        cleaned = cleaned.replace(r'\.', '.')
        return cleaned.strip()

    def split_sentences(self, text: str) -> List[str]:
        if "Sādhu!" in text:
            return [text]
        # Tách theo dấu kết thúc câu
        sentences = re.split(r'(?<=[.?!])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def _add_segment(self, html: str, label: str, segment: str) -> None:
        """Hàm hỗ trợ thêm segment và tự động tăng UID."""
        self.segments_output.append(SegmentData(
            uid=self.uid_counter, html=html, label=label, segment=segment
        ))
        self.uid_counter += 1

    def process_content(self, raw_md: str) -> List[SegmentData]:
        self.segments_output = []
        self.uid_counter = 1
        
        # Loại bỏ metadata đầu file (YAML frontmatter)
        content = re.sub(r'^---.*?---', '', raw_md, flags=re.DOTALL)
        paragraphs = re.split(r'\n\s*\n', content)
        
        rule_pattern = re.compile(RULE_PATTERN_REGEX, re.DOTALL)

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Bỏ qua các phân cách *** hoặc \*\*\*
            if re.match(r'^\\?\*\\?\*\\?\*$', para):
                continue

            # ----------------------------------------------------
            # 1. XỬ LÝ ĐẶC BIỆT TITLE / SUBTITLE / SKIP
            # ----------------------------------------------------
            if para == "# GIỚI BỔN TỲ KHƯU":
                self._add_segment(html="<h1 class=\"title\">{}</h1>", label="title", segment="GIỚI BỔN TỲ KHƯU")
                continue
            
            if para == "**PĀTIMOKKHA BHIKKHU**":
                self._add_segment(html="<h2 class=\"subtitle\">{}</h2>", label="subtitle", segment="PĀTIMOKKHA BHIKKHU")
                continue
            
            if para == "**PHẬT GIÁO NGUYÊN THUỶ THERAVĀDA**":
                continue  # Bỏ qua segment này

            # ----------------------------------------------------
            # 2. XỬ LÝ NOTE (Ghi chú bắt đầu bằng |)
            # ----------------------------------------------------
            if para.startswith("|"):
                # Clean: loại bỏ '|' và '*' 
                clean_note = para.replace('|', '').replace('*', '').strip()
                # Lấy uid của segment liền trước
                note_label = f"note-{self.uid_counter - 1}"
                self._add_segment(html="<p class=\"note\">{}</p>", label=note_label, segment=clean_note)
                continue

            # ----------------------------------------------------
            # 3. XỬ LÝ HEADINGS
            # ----------------------------------------------------
            if para.startswith('#'):
                level_match = re.match(r'^(#+)', para)
                level = len(level_match.group(1))
                text = para.lstrip('#').strip()
                self.labeler.update_context(text, level)
                
                label = self.labeler.get_label()

                # Bổ sung logic bắt "PHẨM \d+"
                if re.match(r'^PHẨM\s+\d+', text, re.IGNORECASE):
                    label = f"{self.labeler.current_prefix}-chapter"

                tmpl = f"<h{level}>{{}}</h{level}>"
                self._add_segment(html=tmpl, label=label, segment=text)
                continue

            # ----------------------------------------------------
            # 4. XỬ LÝ NỘI DUNG (RULES VÀ ĐOẠN VĂN THƯỜNG)
            # ----------------------------------------------------
            match = rule_pattern.match(para)
            if match:
                rule_no = match.group(1)
                text_to_process = match.group(2)
                label = self.labeler.get_label(is_rule=True, rule_no=rule_no)
            else:
                text_to_process = para
                label = self.labeler.get_label()

            # Rule 24 Exception
            if RULE_24_IDENTIFIER in text_to_process:
                sub_parts = [
                    "(Biết rằng): 'Mùa nóng còn lại là một tháng' vị tỳ khưu nên tìm kiếm y choàng tắm mưa.",
                    "(Biết rằng): 'Mùa nóng còn lại là nửa tháng' vị làm xong thì nên mặc.",
                    "Nếu (biết rằng): 'Mùa nóng còn lại là hơn một tháng' rồi tìm kiếm y choàng tắm mưa,",
                    "(nếu biết rằng): 'Mùa nóng còn lại là hơn nửa tháng' sau khi làm xong rồi mặc vào thì (y ấy) nên được xả bỏ và (vị ấy) phạm tội pācittiya."
                ]
                for i, s in enumerate(sub_parts):
                    prefix = "<p>" if i == 0 else ""
                    suffix = "</p>" if i == len(sub_parts) - 1 else "<br>"
                    self._add_segment(html=f"{prefix}{{}}{suffix}", label=label, segment=s)
                continue

            # Đoạn văn thường
            lines = text_to_process.split('\n')
            for i, line in enumerate(lines):
                clean_l = self.clean_text(line)
                if not clean_l:
                    continue
                
                # Không tách nhỏ câu đối với một số phần đặc thù (sk, nidana, sadhu)
                if any(x in label.lower() for x in ["sk", "nidana", "sadhu"]):
                    sentences = [clean_l]
                else:
                    sentences = self.split_sentences(clean_l)

                for j, sent in enumerate(sentences):
                    prefix = "<p>" if (i == 0 and j == 0) else ""
                    suffix = "</p>" if (i == len(lines)-1 and j == len(sentences)-1) else " "
                    if j == len(sentences)-1 and i < len(lines)-1:
                        suffix = "<br>"
                    
                    self._add_segment(html=f"{prefix}{{}}{suffix}", label=label, segment=sent)

        return self.segments_output