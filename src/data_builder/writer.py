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
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Tạo bảng phẳng
        cursor.execute("DROP TABLE IF EXISTS contents")
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
        logger.info(f"✅ Đã lưu SQLite DB tại: {self.db_path}")