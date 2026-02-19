# Path: src/main.py
import sys
import os
import glob
import logging
from src.config.logging_config import setup_logging
from src.data_builder.processor import ContentProcessor
from src.data_builder.writer import DataWriter

setup_logging()
logger = logging.getLogger(__name__)

# Cấu hình đường dẫn mới
DATA_CONTENT_DIR = "data/content"
WEB_DATA_DIR = "web/data"
TSV_OUT = os.path.join(DATA_CONTENT_DIR, "content.tsv")
DB_OUT = os.path.join(WEB_DATA_DIR, "content.db")

def main():
    logger.info("🚀 Khởi động quy trình xây dựng dữ liệu phẳng...")
    
    # Tìm file markdown
    files = glob.glob("data/Gioi bon Viet/*.md")
    if not files:
        logger.error("❌ Không tìm thấy file markdown đầu vào.")
        return

    try:
        # 1. Đọc nội dung
        with open(files[0], 'r', encoding='utf-8') as f:
            raw_md = f.read()

        # 2. Xử lý dữ liệu
        processor = ContentProcessor()
        segments = processor.process_content(raw_md)

        # 3. Ghi dữ liệu (TSV & SQLite)
        writer = DataWriter(TSV_OUT, DB_OUT)
        writer.save(segments)

        logger.info(f"🏁 Hoàn tất! Đã xử lý {len(segments)} segments.")
        
    except Exception as e:
        logger.exception(f"❌ Lỗi: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()