# Path: src/data_builder/processors/quote_processor.py

__all__ = ["QuoteStateProcessor"]

class QuoteStateProcessor:
    """Xử lý bọc thẻ quote cho các trích dẫn nằm giữa ‘ và ’, hỗ trợ đa segment."""
    
    def __init__(self):
        self.in_quote = False

    def process(self, text: str) -> str:
        was_in_quote = self.in_quote
        new_text = ""
        
        # Quét từng ký tự để bắt chính xác lúc mở và đóng ngoặc
        for char in text:
            if char == '‘':
                if not self.in_quote:
                    new_text += "<span class='quote-text'>"
                    self.in_quote = True
                new_text += '‘'
            elif char == '’':
                new_text += '’'
                if self.in_quote:
                    new_text += "</span>"
                    self.in_quote = False
            else:
                new_text += char
                
        # Nếu đoạn này bắt đầu mà đã nằm trong quote (từ đoạn trước kéo sang), mở thẻ ngay từ đầu
        if was_in_quote:
            new_text = "<span class='quote-text'>" + new_text
            
        # Nếu kết thúc đoạn này mà vẫn đang trong quote (chưa có dấu đóng), phải đóng tạm thẻ
        if self.in_quote:
            new_text = new_text + "</span>"
            
        return new_text
