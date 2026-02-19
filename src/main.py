# Path: src/main.py
import sys
import os
import glob
import logging
import argparse
from dotenv import load_dotenv

# Add src to python path to allow imports if run directly
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.config.logging_config import setup_logging
from src.data_builder.processor import ContentProcessor
from src.data_builder.writer import DataWriter
from src.data_builder.tts_generator import TTSGenerator

# Load Environment Variables (.env)
load_dotenv()
setup_logging()
logger = logging.getLogger(__name__)

# Cấu hình đường dẫn
DATA_CONTENT_DIR = "data/content"
WEB_DATA_DIR = "web/data"
TSV_OUT = os.path.join(DATA_CONTENT_DIR, "content.tsv")
DB_OUT = os.path.join(WEB_DATA_DIR, "content.db")
AUDIO_FINAL_DIR = os.path.join(WEB_DATA_DIR, "audio")
AUDIO_TMP_DIR = os.path.join(DATA_CONTENT_DIR, "audio-tmp")

def run_data_builder() -> None:
    """Thực thi logic build dữ liệu từ Markdown sang DB/TSV kèm theo việc sinh Audio TTS."""
    logger.info("🚀 Khởi động quy trình xây dựng dữ liệu và Audio...")
    
    # Tìm file markdown
    files = glob.glob("data/Gioi bon Viet/*.md")
    if not files:
        logger.error("❌ Không tìm thấy file markdown đầu vào.")
        return

    try:
        # 1. Đọc nội dung
        with open(files[0], 'r', encoding='utf-8') as f:
            raw_md = f.read()

        # 2. Khởi tạo Logic
        tts_generator = TTSGenerator(AUDIO_FINAL_DIR, AUDIO_TMP_DIR)
        processor = ContentProcessor(tts_generator)
        segments = processor.process_content(raw_md)

        # 3. Ghi dữ liệu (TSV & SQLite)
        writer = DataWriter(TSV_OUT, DB_OUT)
        writer.save(segments)

        logger.info(f"🏁 Hoàn tất! Đã xử lý {len(segments)} segments và tạo/cache Audio thành công.")
        
    except Exception as e:
        logger.exception(f"❌ Lỗi: {e}")
        sys.exit(1)

def cli() -> None:
    """Cổng giao tiếp CLI cho toàn bộ ứng dụng."""
    parser = argparse.ArgumentParser(description="Công cụ quản lý dự án Giới Bổn")
    subparsers = parser.add_subparsers(dest="command", help="Các lệnh có sẵn")
    
    # Đăng ký lệnh: data
    parser_data = subparsers.add_parser("data", help="Xây dựng dữ liệu & tạo Audio TTS (Markdown -> DB/TSV)")
    
    args = parser.parse_args()
    
    # Điều hướng logic dựa trên lệnh
    if args.command == "data":
        run_data_builder()
    else:
        # Nếu gõ `gioibon` không kèm argument, hiển thị hướng dẫn
        parser.print_help()

if __name__ == "__main__":
    cli()