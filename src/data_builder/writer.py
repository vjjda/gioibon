# Path: src/data_builder/writer.py
import csv
import sqlite3
import os
import logging
import json
import time
import hashlib
from typing import List, Optional
from src.data_builder.models import SegmentData

logger = logging.getLogger(__name__)

__all__ = ["DataWriter"]

class DataWriter:
    def __init__(self, tsv_path: str, db_path: str, audio_dir: Optional[str] = None):
        self.tsv_path = tsv_path
        self.db_path = db_path
        self.audio_dir = audio_dir # Thư mục chứa file audio gốc

    def save(self, data: List[SegmentData]) -> None:
        self._save_tsv(data)
        self._save_sqlite(data)

    def _save_tsv(self, data: List[SegmentData]) -> None:
        os.makedirs(os.path.dirname(self.tsv_path), exist_ok=True)
        with open(self.tsv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["uid", "html", "label", "segment", "audio"], delimiter='\t')
            writer.writeheader()
            for item in data:
                # Chỉ lưu tên file audio vào TSV (để debug dễ hơn)
                writer.writerow(item.model_dump())
        logger.info(f"✅ Đã lưu TSV tại: {self.tsv_path}")

    def _save_sqlite(self, data: List[SegmentData]) -> None:
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        temp_db_path = self.db_path + ".tmp"
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        
        # Thêm cột audio_blob kiểu BLOB
        cursor.execute("""
            CREATE TABLE contents (
                uid INTEGER PRIMARY KEY,
                html TEXT,
                label TEXT,
                segment TEXT,
                audio_name TEXT,
                audio_blob BLOB
            )
        """)
        
        insert_data = []
        for item in data:
            audio_name = item.audio
            audio_blob = None
            
            # Đọc file audio nhúng vào DB
            if self.audio_dir and audio_name and audio_name != 'skip':
                audio_path = os.path.join(self.audio_dir, audio_name)
                if os.path.exists(audio_path):
                    with open(audio_path, 'rb') as f:
                        audio_blob = f.read()
                else:
                    logger.warning(f"⚠️ Không tìm thấy file audio để nhúng: {audio_path}")

            # Tuple khớp với thứ tự cột
            insert_data.append((
                item.uid,
                item.html,
                item.label,
                item.segment,
                audio_name,
                audio_blob
            ))

        cursor.executemany("INSERT INTO contents VALUES (?, ?, ?, ?, ?, ?)", insert_data)
        
        conn.commit()
        conn.close()

        # Logic so sánh và cập nhật file
        if os.path.exists(self.db_path) and self._files_are_identical(self.db_path, temp_db_path):
            logger.info("💤 DB nội dung không thay đổi. Giữ nguyên file cũ (để bảo toàn timestamp).")
            os.remove(temp_db_path)
            # Kiểm tra xem version file có khớp không, nếu không thì force update
            self._save_version_file() 
        else:
            if os.path.exists(self.db_path):
                logger.info("♻️  DB có thay đổi. Đang cập nhật file mới...")
                os.remove(self.db_path)
            else:
                logger.info("✨ Tạo mới DB lần đầu.")
            os.rename(temp_db_path, self.db_path)
            logger.info(f"✅ Đã lưu SQLite DB tại: {self.db_path}")
            self._save_version_file()

    def _save_version_file(self) -> None:
        # 1. Tính hash của file DB hiện tại
        if not os.path.exists(self.db_path):
            return

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
                pass

        # 4. Ghi file mới
        version_info = {
            "version": db_hash,
            "generated_at": int(time.time())
        }
        
        with open(version_path, "w", encoding="utf-8") as f:
            json.dump(version_info, f)
        logger.info(f"🔖 Đã cập nhật DB Version tại: {version_path} (Hash: {db_hash})")

    def _files_are_identical(self, file1: str, file2: str) -> bool:
        def get_hash(filepath):
            with open(filepath, "rb") as f:
                return hashlib.md5(f.read()).hexdigest()
        return get_hash(file1) == get_hash(file2)
