# Path: src/data_builder/writer.py
import csv
import sqlite3
import os
import logging
from typing import List
from src.data_builder.models import SegmentData

logger = logging.getLogger(__name__)

__all__ = ["DataWriter"]

class DataWriter:
    def __init__(self, tsv_path: str, db_path: str):
        self.tsv_path = tsv_path
        self.db_path = db_path

    def save(self, data: List[SegmentData]) -> None:
        self._save_tsv(data)
        self._save_sqlite(data)

    def _save_tsv(self, data: List[SegmentData]) -> None:
        os.makedirs(os.path.dirname(self.tsv_path), exist_ok=True)
        with open(self.tsv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["uid", "html", "label", "segment", "audio"], delimiter='\t')
            writer.writeheader()
            for item in data:
                writer.writerow(item.model_dump())
        logger.info(f"✅ Đã lưu TSV tại: {self.tsv_path}")

    def _save_sqlite(self, data: List[SegmentData]) -> None:
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # [UPDATED] Ghi vào file tạm trước để so sánh nội dung
        temp_db_path = self.db_path + ".tmp"
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

        # Kết nối tới file tạm
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        
        # Tạo bảng phẳng
        cursor.execute("""
            CREATE TABLE contents (
                uid INTEGER PRIMARY KEY,
                html TEXT,
                label TEXT,
                segment TEXT,
                audio TEXT
            )
        """)
        
        # Insert dữ liệu
        insert_data = [tuple(item.model_dump().values()) for item in data]
        cursor.executemany("INSERT INTO contents VALUES (?, ?, ?, ?, ?)", insert_data)
        
        conn.commit()
        conn.close()

        # [LOGIC] So sánh file tạm và file chính
        if os.path.exists(self.db_path) and self._files_are_identical(self.db_path, temp_db_path):
            logger.info("💤 DB nội dung không thay đổi. Giữ nguyên file cũ (để bảo toàn timestamp).")
            os.remove(temp_db_path)
        else:
            if os.path.exists(self.db_path):
                logger.info("♻️  DB có thay đổi. Đang cập nhật file mới...")
                os.remove(self.db_path)
            else:
                logger.info("✨ Tạo mới DB lần đầu.")
            os.rename(temp_db_path, self.db_path)
            logger.info(f"✅ Đã lưu SQLite DB tại: {self.db_path}")

        # [NEW] Tạo file version để frontend burst cache
        self._save_version_file()

    def _save_version_file(self) -> None:
        import json
        import time
        import hashlib
        
        # 1. Tính hash của file DB hiện tại
        with open(self.db_path, "rb") as f:
            db_hash = hashlib.md5(f.read()).hexdigest()
            
        # 2. Xác định đường dẫn file version
        db_filename = os.path.basename(self.db_path)
        version_filename = db_filename.rsplit('.', 1)[0] + "_version.json" if '.' in db_filename else db_filename + "_version.json"
        version_path = os.path.join(os.path.dirname(self.db_path), version_filename)

        # 3. Kiểm tra nếu file version cũ đã tồn tại và hash chưa đổi
        if os.path.exists(version_path):
            try:
                with open(version_path, "r", encoding="utf-8") as f:
                    old_info = json.load(f)
                    if old_info.get("version") == db_hash:
                        logger.info(f"💤 Version file không đổi ({db_hash}). Bỏ qua ghi file json.")
                        return
            except Exception:
                # Nếu file cũ lỗi, cứ lờ đi và ghi mới
                pass

        # 4. Ghi file mới nếu hash khác hoặc chưa có file
        version_info = {
            "version": db_hash,
            "generated_at": int(time.time())
        }
        
        with open(version_path, "w", encoding="utf-8") as f:
            json.dump(version_info, f)
        logger.info(f"🔖 Đã cập nhật DB Version tại: {version_path} (Hash: {db_hash})")

    def _files_are_identical(self, file1: str, file2: str) -> bool:
        """So sánh hash MD5 của 2 file để xác định nội dung có giống nhau không."""
        import hashlib
        def get_hash(filepath):
            with open(filepath, "rb") as f:
                return hashlib.md5(f.read()).hexdigest()
        return get_hash(file1) == get_hash(file2)