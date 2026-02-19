# Path: src/data_builder/processor.py
import re
import logging
from typing import List, Dict, Any
from collections import defaultdict
from src.config.constants import RULE_24_IDENTIFIER, RULE_PATTERN_REGEX
from src.data_builder.models import SegmentData
from src.data_builder.labeler import ContentLabeler
from src.data_builder.tts_generator import TTSGenerator

logger = logging.getLogger(__name__)

__all__ = ["ContentProcessor"]

class ContentProcessor:
    def __init__(self, tts_generator: TTSGenerator):
        self.labeler = ContentLabeler()
        self.tts_generator = tts_generator
        self.uid_counter = 1
        self.raw_segments: List[Dict[str, Any]] = []
        self.segments_output: List[SegmentData] = []

    def clean_text(self, text: str) -> str:
        # Xóa chú thích dạng footnote [^1], [^2]
        cleaned = re.sub(r'\[\^.*?\]', '', text)
        cleaned = cleaned.replace(r'\.', '.')
        return cleaned.strip()

    def split_sentences(self, text: str) -> List[str]:
        if not text:
            return []
        if "Sādhu!" in text:
            return [text]
        # Tách theo dấu kết thúc câu
        sentences = re.split(r'(?<=[.?!])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def segment_sentence(self, sentence: str) -> List[str]:
        """Tách câu dựa trên dấu nháy đơn, giữ lại dấu câu liền kề nháy đóng."""
        s = re.sub(r"(\s|^)'", r"\1<SPLIT>'", sentence)
        # Bắt dấu nháy đóng kèm theo dấu câu (nếu có) và theo sau là khoảng trắng hoặc hết chuỗi
        s = re.sub(r"'([.,;:]*)(?=\s|$)", r"'\1<SPLIT>", s)
        parts = s.split("<SPLIT>")
        return [p.strip() for p in parts if p.strip()]

    def _add_segment(self, html: str, label: str, segment: str) -> None:
        """Lưu trữ dữ liệu vào danh sách tạm (raw) để thực hiện thống kê trước khi gen Audio."""
        self.raw_segments.append({
            "uid": self.uid_counter,
            "html": html,
            "label": label,
            "segment": segment
        })
        self.uid_counter += 1

    def process_content(self, raw_md: str) -> List[SegmentData]:
        self.segments_output = []
        self.raw_segments = []
        self.uid_counter = 1
        
        # Loại bỏ metadata đầu file (YAML frontmatter)
        content = re.sub(r'^---.*?---', '', raw_md, flags=re.DOTALL)
        paragraphs = re.split(r'\n\s*\n', content)
        
        rule_pattern = re.compile(RULE_PATTERN_REGEX, re.DOTALL)

        # Chuỗi ngoại lệ không được cắt nháy đơn
        SILENCE_EXCEPTION = "Do thái độ im lặng, tôi sẽ nhận biết về các đại đức rằng: '(Các vị) được trong sạch.'"

        # ==========================================
        # BƯỚC 1: PARSE MARKDOWN THÀNH CÁC RAW SEGMENT
        # ==========================================
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Bỏ qua các phân cách *** hoặc \*\*\*
            if re.match(r'^\\?\*\\?\*\\?\*$', para):
                continue

            if para == "# GIỚI BỔN TỲ KHƯU":
                self._add_segment(html="<h1 class=\"title\">{}</h1>", label="title", segment="GIỚI BỔN TỲ KHƯU")
                continue
            
            if para == "**PĀTIMOKKHA BHIKKHU**":
                self._add_segment(html="<h2 class=\"subtitle\">{}</h2>", label="subtitle", segment="PĀTIMOKKHA BHIKKHU")
                continue
            
            if para == "**PHẬT GIÁO NGUYÊN THUỶ THERAVĀDA**":
                continue  

            if para.startswith("|"):
                clean_note = para.replace('|', '').replace('*', '').strip()
                note_label = f"note-{self.uid_counter - 1}"
                self._add_segment(html="<p class=\"note\">{}</p>", label=note_label, segment=clean_note)
                continue

            if para.startswith('#'):
                level_match = re.match(r'^(#+)', para)
                level = len(level_match.group(1))
                text = para.lstrip('#').strip()
                self.labeler.update_context(text, level)
                
                label = self.labeler.get_label()
                if re.match(r'^PHẨM\s+\d+', text, re.IGNORECASE):
                    label = f"{self.labeler.current_prefix}-chapter"

                tmpl = f"<h{level}>{{}}</h{level}>"
                self._add_segment(html=tmpl, label=label, segment=text)
                continue

            match = rule_pattern.match(para)
            if match:
                rule_no = match.group(1)
                text_to_process = match.group(2)
                label = self.labeler.get_label(is_rule=True, rule_no=rule_no)
            else:
                text_to_process = para
                label = self.labeler.get_label()

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

            lines = text_to_process.split('\n')
            for i, line in enumerate(lines):
                clean_l = self.clean_text(line)
                if not clean_l:
                    continue
                
                is_sadhu = "sadhu" in clean_l.lower()
                is_sekhiya = "sk" in label.lower()
                
                line_segments = []
                sentences = self.split_sentences(clean_l)
                
                if is_sekhiya or is_sadhu:
                    line_segments = sentences
                else:
                    for sent in sentences:
                        if SILENCE_EXCEPTION in sent:
                            line_segments.append(sent)
                        else:
                            line_segments.extend(self.segment_sentence(sent))

                num_segs = len(line_segments)
                for j, seg in enumerate(line_segments):
                    prefix = "<p>" if (i == 0 and j == 0) else ""
                    suffix = "</p>" if (i == len(lines)-1 and j == num_segs-1) else " "
                    if j == num_segs-1 and i < len(lines)-1:
                        suffix = "<br>"
                    
                    self._add_segment(html=f"{prefix}{{}}{suffix}", label=label, segment=seg)

        # ==========================================
        # BƯỚC 2: THỐNG KÊ LABEL VÀ SINH AUDIO
        # ==========================================
        label_totals = defaultdict(int)
        for item in self.raw_segments:
            if item["segment"].strip() and not item["label"].startswith("note-"):
                label_totals[item["label"]] += 1
                
        # Nạp tổng số lượng vào TTS Generator
        self.tts_generator.set_label_totals(label_totals)
        
        # Chạy vòng lặp để tạo Audio và xuất dữ liệu chuẩn
        for item in self.raw_segments:
            audio_filename = self.tts_generator.process_segment(item["uid"], item["label"], item["segment"])
            self.segments_output.append(SegmentData(
                uid=item["uid"],
                html=item["html"],
                label=item["label"],
                segment=item["segment"],
                audio=audio_filename
            ))

        return self.segments_output