# Path: src/main.py
import sys
import os
import logging
import argparse
from dotenv import load_dotenv

# Add src to python path to allow imports if run directly
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.config.logging_config import setup_logging
from src.data_builder.writer import DataWriter
from src.data_builder.tts_generator import TTSGenerator
from src.data_builder.tsv_processor import TsvContentProcessor

# Load Environment Variables (.env)
load_dotenv()
setup_logging()
logger = logging.getLogger(__name__)

# Cấu hình đường dẫn
DATA_CONTENT_DIR = "data/content"
WEB_DATA_DIR = "web/public/app-content"
TSV_SOURCE = os.path.join(DATA_CONTENT_DIR, "content_source.tsv")
TSV_OUT = os.path.join(DATA_CONTENT_DIR, "content.tsv")
DB_OUT = os.path.join(WEB_DATA_DIR, "content.db")
AUDIO_FINAL_DIR = os.path.join(WEB_DATA_DIR, "audio")
AUDIO_TMP_DIR = os.path.join(DATA_CONTENT_DIR, "audio-tmp")


def run_data_builder(clean: bool = False) -> None:
    """Thực thi logic build dữ liệu từ TSV Source sang DB/TSV kèm theo việc sinh Audio TTS."""
    logger.info("🚀 Khởi động quy trình xây dựng dữ liệu và Audio từ TSV Source...")

    if not os.path.exists(TSV_SOURCE):
        logger.error(f"❌ Không tìm thấy file nguồn: {TSV_SOURCE}")
        return

    try:
        # 1. Khởi tạo Logic
        tts_generator = TTSGenerator(AUDIO_FINAL_DIR, AUDIO_TMP_DIR)
        processor = TsvContentProcessor(tts_generator)

        # 2. Xử lý nội dung từ TSV
        segments = processor.process_tsv(TSV_SOURCE)

        # 3. Ghi dữ liệu (TSV & SQLite)
        writer = DataWriter(TSV_OUT, DB_OUT, AUDIO_TMP_DIR)
        writer.save(segments)

        logger.info(
            f"🏁 Hoàn tất! Đã xử lý {len(segments)} segments và tạo/cache Audio thành công."
        )

        # 4. Thực hiện dọn dẹp nếu có cờ --clean
        if clean:
            # Lấy danh sách file audio đang được sử dụng
            active_filenames = [seg.audio for seg in segments if seg.audio and seg.audio != "skip"]
            
            logger.info("🔍 Đang kiểm tra thư mục audio-tmp để tìm file rác...")
            garbage_files = tts_generator.get_garbage_files(active_filenames)
            
            if not garbage_files:
                logger.info("✨ Thư mục audio-tmp đã sạch sẽ, không có file thừa.")
            else:
                total_garbage = len(garbage_files)
                print(f"\n⚠️  Tìm thấy {total_garbage} file thừa trong audio-tmp:")
                
                # Hiển thị tối đa 10 file đầu tiên
                for f in garbage_files[:10]:
                    print(f"  - {f}")
                
                if total_garbage > 10:
                    print(f"  ... và {total_garbage - 10} file khác.")
                
                # Hỏi xác nhận người dùng
                confirm = input(f"\n❓ Bạn có chắc chắn muốn xóa {total_garbage} file này không? (y/N): ").strip().lower()
                
                if confirm == 'y':
                    deleted_count = tts_generator.remove_files(garbage_files)
                    logger.info(f"✨ Đã xóa thành công {deleted_count} file rác.")
                else:
                    logger.info("🚫 Đã hủy thao tác dọn dẹp.")

    except Exception as e:
        logger.exception(f"❌ Lỗi: {e}")
        sys.exit(1)


def cli() -> None:
    """Cổng giao tiếp CLI cho toàn bộ ứng dụng."""
    parser = argparse.ArgumentParser(description="Công cụ quản lý dự án Giới Bổn")
    subparsers = parser.add_subparsers(dest="command", help="Các lệnh có sẵn")

    # Đăng ký lệnh: data
    parser_data = subparsers.add_parser(
        "data", help="Xây dựng dữ liệu & tạo Audio TTS (Markdown -> DB/TSV)"
    )
    # Thêm cờ --clean
    parser_data.add_argument(
        "--clean",
        action="store_true",
        help="Dọn dẹp thư mục audio-tmp (xóa các file audio cũ không còn sử dụng)."
    )

    args = parser.parse_args()

    # Điều hướng logic dựa trên lệnh
    if args.command == "data":
        run_data_builder(clean=args.clean)
    else:
        # Nếu gõ `gioibon` không kèm argument, hiển thị hướng dẫn
        parser.print_help()


if __name__ == "__main__":
    cli()
