# Path: src/data_builder/processors/addition_processor.py
import re

__all__ = ["AdditionProcessor"]

class AdditionProcessor:
    """Xử lý phần bổ sung của dịch giả (ngoặc đơn) và tên Pali (heading)."""

    def process(self, text: str, is_heading: bool, label: str, html_template: str) -> str:
        if is_heading:
            # Chỉ bọc Pali trong ngoặc đơn cho heading (Giữ nguyên dấu ngoặc)
            if (html_template.startswith("<h") or label.endswith("-chapter")) and (label.endswith("-name") or label.endswith("-chapter")):
                pali_pattern = r"\(.*?\)"
                return re.sub(pali_pattern, r"<span class='pali-name'>\g<0></span>", text)
            return text
        else:
            # Xử lý phần bổ sung của dịch giả cho văn bản thường (Bỏ dấu ngoặc đơn, bọc thẻ trans-addition)
            trans_pattern = r"\((.*?)\)"
            return re.sub(trans_pattern, r"<span class='trans-addition'>\1</span>", text)
