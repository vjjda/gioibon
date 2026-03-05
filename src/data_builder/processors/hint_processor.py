# Path: src/data_builder/processors/hint_processor.py
import re

__all__ = ["HintProcessor"]

class HintProcessor:
    """Xử lý tạo nội dung Hint Mode (bọc hint-tail cho từ)."""

    def process(self, text: str) -> str:
        """Bọc phần đuôi của các từ vào thẻ span.hint-tail để dùng cho Hint Mode."""
        if not text:
            return ""

        # Regex này khớp với: (Phụ âm đầu hoặc Chữ cái đầu) (Các chữ cái tiếp theo)
        pattern = r"\b(ngh|ch|gh|gi|kh|ng|nh|ph|qu|th|tr|[^\W\d_])([^\W\d_]+)"

        # Split text by HTML tags to preserve them
        parts = re.split(r'(<[^>]+>)', text)
        result = []
        for part in parts:
            if part.startswith('<') and part.endswith('>'):
                result.append(part)
            else:
                result.append(re.sub(pattern, r"\1<span class='hint-tail'>\2</span>", part, flags=re.IGNORECASE | re.UNICODE))

        return "".join(result)
