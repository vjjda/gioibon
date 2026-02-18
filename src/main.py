# Path: src/main.py
import sys
import os
import logging

# Add src to python path to allow imports if run directly
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.data_builder.converter import DataBuilder
from src.config.logging_config import setup_logging
from src.config.constants import INPUT_MARKDOWN_PATTERN, OUTPUT_JSON_PATH

# Setup logging immediately
setup_logging()
logger = logging.getLogger(__name__)

def main():
    logger.info("🚀 Bắt đầu quá trình build dữ liệu...")
    
    try:
        builder = DataBuilder(INPUT_MARKDOWN_PATTERN, OUTPUT_JSON_PATH)
        builder.run()
        logger.info("🏁 Hoàn tất.")
    except Exception as e:
        logger.exception("❌ Đã xảy ra lỗi không mong muốn:")
        sys.exit(1)

if __name__ == "__main__":
    main()
