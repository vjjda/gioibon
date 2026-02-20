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
from collections import defaultdict

from mutagen.mp3 import MP3
from mutagen.id3 import ID3, USLT, TIT2, TALB, TPE1, TRCK

logger = logging.getLogger(__name__)

__all__ = ["TTSGenerator"]

class TTSGenerator:
    def __init__(self, output_dir: str, tmp_dir: str):
        self.output_dir = output_dir
        self.tmp_dir = tmp_dir
        self.api_key = os.getenv("GOOGLE_TTS_API_KEY")
        self.voice_name = "vi-VN-Chirp3-HD-Charon"
        self.language_code = "vi-VN"
        
        self.label_counts: Dict[str, int] = defaultdict(int)
        self.label_totals: Dict[str, int] = defaultdict(int)
        
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

    def set_label_totals(self, totals: Dict[str, int]) -> None:
        """Nhận tổng số lượng của từng label để xử lý việc đặt tên file."""
        self.label_totals = totals

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

    def _add_metadata(self, filepath: str, text: str, title: str, track_no: str) -> None:
        """Gắn thẻ ID3 cho file MP3."""
        try:
            audio = MP3(filepath, ID3=ID3)
            if audio.tags is None:
                audio.add_tags()
                
            audio.tags.add(USLT(encoding=3, lang='vie', desc='', text=text))
            audio.tags.add(TIT2(encoding=3, text=title))
            audio.tags.add(TALB(encoding=3, text="Giới bổn Patimokkha Việt"))
            audio.tags.add(TPE1(encoding=3, text="Vi-Charon"))
            audio.tags.add(TRCK(encoding=3, text=track_no))
            audio.save()
        except Exception as e:
            logger.error(f"❌ Lỗi thêm metadata vào {filepath}: {e}")

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

    def process_segment(self, uid: int, label: str, segment_text: str, html: str = "") -> str:
        """Xử lý đoạn văn, trả về tên file MP3 cuối cùng, hoặc 'skip' nếu được loại trừ."""
        if not segment_text.strip() or label.startswith("note-") or label.endswith("-name") or label in ["title", "subtitle"] or html.startswith("<h"):
            return "skip"

        # 1. Áp dụng toàn bộ quy tắc động từ file JSON
        tts_text = self._apply_tts_rules(segment_text)

        if not tts_text:
            return "skip"

        self.label_counts[label] += 1
        count = self.label_counts[label]
        total = self.label_totals.get(label, 0)
        
        uid_padded = f"{uid:03d}"
        
        # 2. Sinh Hash
        text_hash = self._get_hash(tts_text)[:16] 
        
        # 3. Phân tách title metadata và filename
        if total > 1:
            title_base = f"{uid_padded}_{label}_{count}"
        else:
            title_base = f"{uid_padded}_{label}"
            
        filename = f"{title_base}____{text_hash}.mp3"
        
        final_filepath = os.path.join(self.output_dir, filename)
        tmp_filepath = os.path.join(self.tmp_dir, f"{text_hash}.mp3")

        # 4. Kiểm tra cache
        if os.path.exists(tmp_filepath):
            shutil.copy2(tmp_filepath, final_filepath)
            self._add_metadata(final_filepath, segment_text, title_base, uid_padded)
        else:
            # 5. Gọi API với bản text sạch
            if self._fetch_audio_from_api(tts_text, tmp_filepath):
                shutil.copy2(tmp_filepath, final_filepath)
                self._add_metadata(tmp_filepath, segment_text, title_base, uid_padded)
                self._add_metadata(final_filepath, segment_text, title_base, uid_padded)
                logger.debug(f"✅ Đã tạo mới Audio: {filename}")

        return filename

