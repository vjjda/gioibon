# Path: src/config/logging_config.py
import logging
import sys

def setup_logging(log_level: int = logging.INFO) -> None:
    """Cấu hình logging chuẩn cho toàn bộ ứng dụng."""
    
    # Định dạng log: Time | Level | Logger | Message
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Handler xuất ra Console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    # Cấu hình Root Logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Xóa các handler cũ để tránh duplicate
    if root_logger.hasHandlers():
        root_logger.handlers.clear()
        
    root_logger.addHandler(console_handler)
