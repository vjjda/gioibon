# Path: src/data_builder/processors/base.py
import re

__all__ = ["strip_html_tags", "clean_brackets"]

def strip_html_tags(text: str) -> str:
    """Loại bỏ hoàn toàn các thẻ HTML khỏi văn bản."""
    if not text:
        return ""
    return re.sub(r'<[^>]+>', '', text)

def clean_brackets(text: str) -> str:
    """Loại bỏ các loại ngoặc đơn và ngoặc vuông để phục vụ tìm kiếm/TTS."""
    if not text:
        return ""
    return re.sub(r'\(|\)|\[|\]', '', text)
