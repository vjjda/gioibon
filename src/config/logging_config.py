# Path: src/config/logging_config.py
import logging
import sys
from datetime import datetime

class ConciseFormatter(logging.Formatter):
    """Formatter tối giản: [HH:MM:SS] Message"""

    def format(self, record: logging.LogRecord) -> str:
        # Timestamp ngắn gọn: 17:08:48
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        
        # Với level INFO, chỉ hiện giờ và message (vì message đã có emoji phân loại)
        if record.levelno == logging.INFO:
            return f"[{timestamp}] {record.getMessage()}"
        
        # Với các level khác (WARNING, ERROR), hiện thêm Level để chú ý
        return f"[{timestamp}] [{record.levelname}] {record.getMessage()}"

def setup_logging(log_level: int = logging.INFO) -> None:
    """Cấu hình logging chuẩn cho toàn bộ ứng dụng."""
    
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Xóa handler cũ để tránh duplicate khi reload
    if root_logger.hasHandlers():
        root_logger.handlers.clear()

    # Tạo Handler mới với Formatter tối giản
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ConciseFormatter())
    
    root_logger.addHandler(console_handler)
