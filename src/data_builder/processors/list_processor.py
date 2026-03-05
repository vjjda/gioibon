# Path: src/data_builder/processors/list_processor.py

__all__ = ["ListProcessor"]

class ListProcessor:
    """Xử lý định dạng danh sách duyenco và chuẩn hoá HTML templates."""

    def process_duyenco(self, text: str) -> str:
        """Xử lý định dạng danh sách duyenco."""
        parts = [p.strip() for p in text.split(';') if p.strip()]
        if not parts:
            return text

        if len(parts) == 1:
            return f"<ul class='duyenco-list single-item'><li><span class='duyenco-content'>{parts[0]}</span></li></ul>"
        else:
            list_items = "".join([f"<li><span class='duyenco-content'>{p}</span></li>" for p in parts])
            return f"<ol class='duyenco-list multi-item'>{list_items}</ol>"

    def ensure_valid_html(self, html_template: str, current_display_text: str) -> str:
        """Tự động chuyển đổi template p -> div nếu nội dung chứa các thẻ block (div, ul, ol)."""
        if any(tag in current_display_text for tag in ["<div", "<ul", "<ol"]):
            if html_template.startswith("<p"):
                return html_template.replace("<p", "<div").replace("</p>", "</div>")
        return html_template
