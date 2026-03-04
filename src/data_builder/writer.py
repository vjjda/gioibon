# Path: src/data_builder/writer.py
import csv
import sqlite3
import os
import logging
import json
import time
import hashlib
import shutil
import zipfile
from typing import List, Optional, Set

from src.data_builder.models import SegmentData

logger = logging.getLogger(__name__)

__all__ = ["DataWriter"]

class DataWriter:
    def __init__(self, tsv_path: str, db_path: str, tmp_audio_dir: Optional[str] = None, final_audio_dir: Optional[str] = None) -> None:
        self.tsv_path: str = tsv_path
        self.db_path: str = db_path
        self.tmp_audio_dir: Optional[str] = tmp_audio_dir
        self.final_audio_dir: Optional[str] = final_audio_dir

    def save(self, data: List[SegmentData]) -> None:
        self._save_tsv(data)
        self._save_sqlite(data)
        self._copy_audio_files(data)

    def _save_tsv(self, data: List[SegmentData]) -> None:
        os.makedirs(os.path.dirname(self.tsv_path), exist_ok=True)
        with open(self.tsv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["uid", "html", "label", "segment", "audio", "segment_html", "has_hint"], delimiter='\t')
            writer.writeheader()
            for item in data:
                writer.writerow(item.model_dump())
        logger.info(f"✅ Đã lưu TSV tại: {self.tsv_path}")

    def _save_sqlite(self, data: List[SegmentData]) -> None:
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        temp_db_path: str = self.db_path + ".tmp"
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE contents (
                uid INTEGER PRIMARY KEY,
                html TEXT,
                label TEXT,
                segment TEXT,
                audio_name TEXT,
                segment_html TEXT,
                has_hint INTEGER
            )
        """)
        
        insert_contents: List[tuple] = []
        
        for item in data:
            insert_contents.append((
                item.uid,
                item.html,
                item.label,
                item.segment,
                item.audio,
                item.segment_html,
                item.has_hint
            ))

        cursor.executemany("INSERT INTO contents VALUES (?, ?, ?, ?, ?, ?, ?)", insert_contents)
        
        conn.commit()
        conn.close()

        if os.path.exists(self.db_path) and self._files_are_identical(self.db_path, temp_db_path):
            logger.info("💤 DB nội dung không thay đổi. Giữ nguyên file cũ (để bảo toàn timestamp).")
            os.remove(temp_db_path)
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

    def _copy_audio_files(self, data: List[SegmentData]) -> None:
        if not self.tmp_audio_dir or not self.final_audio_dir:
            return
            
        os.makedirs(self.final_audio_dir, exist_ok=True)
        
        # 1. Lấy danh sách các file audio DUY NHẤT thực sự được dùng trong db
        required_audios: Set[str] = {item.audio for item in data if item.audio and item.audio != 'skip'}
        
        # 2. Xóa sạch thư mục đích để dọn dẹp file cũ không còn dùng
        for f in os.listdir(self.final_audio_dir):
            file_path = os.path.join(self.final_audio_dir, f)
            if os.path.isfile(file_path):
                os.remove(file_path)

        copied_count = 0
        missing_count = 0
        
        # 3. Chỉ copy đúng các file có trong tập required_audios
        for audio_name in required_audios:
            src_path = os.path.join(self.tmp_audio_dir, audio_name)
            dest_path = os.path.join(self.final_audio_dir, audio_name)
            
            if os.path.exists(src_path):
                shutil.copy2(src_path, dest_path)
                copied_count += 1
            else:
                missing_count += 1
                logger.warning(f"⚠️ Không tìm thấy file audio trong cache để copy: {audio_name}")
                    
        logger.info(f"✅ Đã đồng bộ {copied_count} file audio (lọc từ {len(data)} segments) ra thư mục Web.")
        if missing_count > 0:
            logger.warning(f"⚠️ Thiếu {missing_count} file audio. Hãy thử chạy lại không có --clean hoặc kiểm tra API.")

        # 4. Nén toàn bộ thành file audio.zip (Bỏ qua cấu trúc thư mục)
        if copied_count > 0:
            zip_path = os.path.join(os.path.dirname(self.final_audio_dir), "audio.zip")
            logger.info(f"📦 Đang nén {copied_count} file âm thanh thành audio.zip...")
            try:
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for audio_name in required_audios:
                        file_to_zip = os.path.join(self.final_audio_dir, audio_name)
                        if os.path.exists(file_to_zip):
                            zipf.write(file_to_zip, arcname=audio_name)
                logger.info(f"✅ Đã tạo file nén tại: {zip_path}")
            except Exception as e:
                logger.error(f"❌ Lỗi khi tạo file audio.zip: {e}")

    def _save_version_file(self) -> None:
        if not os.path.exists(self.db_path):
            return

        with open(self.db_path, "rb") as f:
            db_hash: str = hashlib.md5(f.read()).hexdigest()
            
        db_filename: str = os.path.basename(self.db_path)
        version_filename: str = db_filename.rsplit('.', 1)[0] + "_version.json" if '.' in db_filename else db_filename + "_version.json"
        version_path: str = os.path.join(os.path.dirname(self.db_path), version_filename)

        if os.path.exists(version_path):
            try:
                with open(version_path, "r", encoding="utf-8") as f:
                    old_info: dict = json.load(f)
                    if old_info.get("version") == db_hash:
                        logger.info(f"💤 Version file không đổi ({db_hash}). Bỏ qua ghi file json.")
                        return
            except Exception:
                pass

        version_info: dict = {
            "version": db_hash,
            "generated_at": int(time.time())
        }
        
        with open(version_path, "w", encoding="utf-8") as f:
            json.dump(version_info, f)
        logger.info(f"🔖 Đã cập nhật DB Version tại: {version_path} (Hash: {db_hash})")

    def _files_are_identical(self, file1: str, file2: str) -> bool:
        def get_hash(filepath: str) -> str:
            with open(filepath, "rb") as f:
                return hashlib.md5(f.read()).hexdigest()
        return get_hash(file1) == get_hash(file2)

