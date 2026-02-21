# Path: src/data_builder/tts_generator.py
import os
import shutil
import hashlib
import requests
import base64
import logging
import re
import json
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

__all__ = ["TTSGenerator"]

class TTSGenerator:
    def __init__(self, output_dir: str, tmp_dir: str):
        self.output_dir = output_dir
        self.tmp_dir = tmp_dir
        self.api_key = os.getenv("GOOGLE_TTS_API_KEY")
        self.voice_name = "vi-VN-Chirp3-HD-Charon"
        self.language_code = "vi-VN"
        
        self.tts_rules: Dict[str, Any] = {}
        
        self._load_rules()
        self._prepare_directories()

    def _load_rules(self) -> None:
        """Đọc quy tắc tiền xử lý Text từ file JSON dùng chung."""
        rules_path = "web/public/app-content/tts_rules.json"
        if os.path.exists(rules_path):
            try:
                with open(rules_path, 'r', encoding='utf-8') as f:
                    self.tts_rules = json.load(f)
                logger.info("Đã tải tts_rules.json thành công.")
            except Exception as e:
                logger.error(f"❌ Lỗi đọc file tts_rules.json: {e}")

    def _prepare_directories(self) -> None:
        """Xóa thư mục output cũ để dọn rác, và tạo lại các thư mục cần thiết."""
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.tmp_dir, exist_ok=True)

    def _get_hash(self, text: str) -> str:
        """Tạo mã băm SHA-256 bao gồm cả nội dung và cấu hình giọng đọc."""
        raw_data = f"{text}|{self.voice_name}|{self.language_code}"
        return hashlib.sha256(raw_data.encode('utf-8')).hexdigest()

    def _fetch_audio_from_api(self, text: str, output_filepath: str) -> bool:
        """Gọi API Google TTS và lưu file."""
        if not self.api_key:
            logger.warning("⚠️ Thiếu GOOGLE_TTS_API_KEY. Bỏ qua tạo audio từ API.")
            return False

        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.api_key}"
        payload: Dict[str, Any] = {
            "input": {"text": text},
            "voice": {"languageCode": self.language_code, "name": self.voice_name},
            "audioConfig": {"audioEncoding": "MP3"}
        }

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            content: Optional[str] = response.json().get('audioContent')
            if content:
                with open(output_filepath, 'wb') as f:
                    f.write(base64.b64decode(content))
                return True
        except Exception as e:
            logger.error(f"❌ Lỗi sinh audio cho '{text[:30]}...': {e}")
        return False

    def _apply_tts_rules(self, text: str) -> str:
        """Áp dụng quy tắc từ tts_rules.json chung của cả Frontend và Backend."""
        rules = self.tts_rules
        if not rules:
            return text
            
        if rules.get("remove_html"):
            text = re.sub(r'<[^>]*>?', '', text)
            
        if rules.get("remove_chars_regex"):
            text = re.sub(rules["remove_chars_regex"], ' ', text)
            
        if rules.get("collapse_spaces"):
            text = re.sub(r'\s+', ' ', text).strip()
            
        for word, phonetic in rules.get("phonetics", {}).items():
            pattern = re.compile(re.escape(word), re.IGNORECASE)
            text = pattern.sub(phonetic, text)
            
        if rules.get("capitalize_upper") and text.isupper():
            text = text.capitalize()
            
        return text

    def process_segment(self, segment_text: str, html: str = "", label: str = "") -> str:
        """Xử lý đoạn văn, trả về tên file MP3 (hash) hoặc 'skip'."""
        # Logic skip dựa trên label và html structure
        if not segment_text.strip() or label.startswith("note-") or label.endswith("-name") or label in ["title", "subtitle"] or html.startswith("<h"):
            return "skip"

        # 1. Áp dụng toàn bộ quy tắc động từ file JSON
        tts_text = self._apply_tts_rules(segment_text)

        if not tts_text:
            return "skip"

        # 2. Sinh Hash (chỉ dùng hash làm tên file)
        text_hash = self._get_hash(tts_text)[:16]
        filename = f"{text_hash}.mp3"
        
        final_filepath = os.path.join(self.output_dir, filename)
        tmp_filepath = os.path.join(self.tmp_dir, filename)

        # 3. Kiểm tra cache/tồn tại
        if os.path.exists(tmp_filepath):
            if not os.path.exists(final_filepath):
                 shutil.copy2(tmp_filepath, final_filepath)
        else:
            # 4. Gọi API với bản text sạch
            if self._fetch_audio_from_api(tts_text, tmp_filepath):
                shutil.copy2(tmp_filepath, final_filepath)
                logger.debug(f"✅ Đã tạo mới Audio: {filename}")
            else:
                # Nếu lỗi API, trả về skip để tránh lỗi frontend
                return "skip"

        return filename

    def get_garbage_files(self, active_filenames: list[str]) -> list[str]:
        """Trả về danh sách các file trong thư mục cache không được sử dụng."""
        if not os.path.exists(self.tmp_dir):
            return []
            
        active_set = set(active_filenames)
        garbage_files = []
        
        # Lấy danh sách file trong thư mục tmp
        files = os.listdir(self.tmp_dir)
        for f in files:
            file_path = os.path.join(self.tmp_dir, f)
            # Chỉ check file (bỏ qua folder con và file ẩn như .DS_Store)
            if os.path.isfile(file_path) and not f.startswith('.'):
                if f not in active_set:
                    garbage_files.append(f)
                    
        return garbage_files

    def remove_files(self, filenames: list[str]) -> int:
        """Xóa danh sách file được chỉ định trong tmp_dir."""
        count = 0
        for f in filenames:
            file_path = os.path.join(self.tmp_dir, f)
            try:
                os.remove(file_path)
                count += 1
                logger.debug(f"Đã xóa file rác: {f}")
            except OSError as e:
                logger.warning(f"Không thể xóa file {f}: {e}")
        return count
