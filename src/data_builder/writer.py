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

from src.data_builder.models import SegmentData, RuleData, HeadingData

logger = logging.getLogger(__name__)

__all__ = ["DataWriter"]

class DataWriter:
    def __init__(self, tsv_path: str, db_path: str, tmp_audio_dir: Optional[str] = None, final_audio_dir: Optional[str] = None) -> None:
        self.tsv_path: str = tsv_path
        self.db_path: str = db_path
        self.tmp_audio_dir: Optional[str] = tmp_audio_dir
        self.final_audio_dir: Optional[str] = final_audio_dir

    def save(self, data: List[SegmentData], rules: List[RuleData] = None, headings: List[HeadingData] = None) -> None:
        if rules is None: rules = []
        if headings is None: headings = []
        self._save_tsv(data)
        self._save_sqlite(data, rules, headings)
        self._copy_audio_files(data)

    def _save_tsv(self, data: List[SegmentData]) -> None:
        os.makedirs(os.path.dirname(self.tsv_path), exist_ok=True)
        with open(self.tsv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["uid", "html", "label", "segment", "audio", "segment_html", "has_hint", "hint_text", "heading_id", "rule_id"], delimiter='\t')
            writer.writeheader()
            for item in data:
                writer.writerow(item.model_dump())
        logger.info(f"✅ Đã lưu TSV tại: {self.tsv_path}")

    def _save_sqlite(self, data: List[SegmentData], rules: List[RuleData], headings: List[HeadingData]) -> None:
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        temp_db_path: str = self.db_path + ".tmp"
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        
        # Tạo bảng contents
        cursor.execute("""
            CREATE TABLE contents (
                uid INTEGER PRIMARY KEY,
                html TEXT,
                label TEXT,
                segment TEXT,
                audio_name TEXT,
                segment_html TEXT,
                has_hint INTEGER,
                hint_text TEXT,
                heading_id INTEGER,
                rule_id TEXT
            )
        """)

        # Tạo bảng FTS5 (Full Text Search) ảo cho cột segment
        cursor.execute("""
            CREATE VIRTUAL TABLE contents_fts USING fts5(
                segment,
                content='contents',
                content_rowid='uid',
                tokenize='unicode61 remove_diacritics 0'
            )
        """)
        
        # Tạo Trigger để tự động đồng bộ contents -> contents_fts
        cursor.executescript("""
            CREATE TRIGGER contents_ai AFTER INSERT ON contents BEGIN
                INSERT INTO contents_fts(rowid, segment) VALUES (new.uid, new.segment);
            END;
            
            CREATE TRIGGER contents_ad AFTER DELETE ON contents BEGIN
                INSERT INTO contents_fts(contents_fts, rowid, segment) VALUES('delete', old.uid, old.segment);
            END;
            
            CREATE TRIGGER contents_au AFTER UPDATE ON contents BEGIN
                INSERT INTO contents_fts(contents_fts, rowid, segment) VALUES('delete', old.uid, old.segment);
                INSERT INTO contents_fts(rowid, segment) VALUES (new.uid, new.segment);
            END;
        """)
        
        # Tạo bảng rules
        cursor.execute("""
            CREATE TABLE rules (
                id TEXT PRIMARY KEY,
                type INTEGER,
                acronym TEXT,
                pali TEXT,
                viet TEXT,
                "group" TEXT
            )
        """)
        
        # Tạo bảng headings
        cursor.execute("""
            CREATE TABLE headings (
                uid INTEGER PRIMARY KEY,
                text TEXT,
                level INTEGER,
                parent_uid INTEGER,
                breadcrumbs TEXT
            )
        """)
        
        # Chèn dữ liệu contents
        insert_contents: List[tuple] = []
        for item in data:
            insert_contents.append((
                item.uid,
                item.html,
                item.label,
                item.segment,
                item.audio,
                item.segment_html,
                item.has_hint,
                item.hint_text,
                item.heading_id,
                item.rule_id
            ))
        cursor.executemany("INSERT INTO contents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", insert_contents)
        
        # Chèn dữ liệu rules (loại bỏ trùng lặp nếu có do rule_groups và extracted data)
        seen_rules = set()
        insert_rules: List[tuple] = []
        for r in rules:
            if r.id not in seen_rules:
                seen_rules.add(r.id)
                insert_rules.append((r.id, r.type, r.acronym, r.pali, r.viet, r.group))
        cursor.executemany('INSERT INTO rules (id, type, acronym, pali, viet, "group") VALUES (?, ?, ?, ?, ?, ?)', insert_rules)
        
        # Chèn dữ liệu headings
        seen_headings = set()
        insert_headings: List[tuple] = []
        for h in headings:
            if h.uid not in seen_headings:
                seen_headings.add(h.uid)
                insert_headings.append((h.uid, h.text, h.level, h.parent_uid, h.breadcrumbs))
        cursor.executemany("INSERT INTO headings VALUES (?, ?, ?, ?, ?)", insert_headings)
        
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

