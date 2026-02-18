# Path: scripts/generate_audio_sentences.py

import os
import csv
import hashlib
import json
import shutil
import re
import requests
import unicodedata
import base64
from typing import Dict, Any, Optional

from mutagen.mp3 import MP3
from mutagen.id3 import ID3, USLT, TIT2, TALB, TPE1, TRCK

__all__ = ["slugify", "get_audio_hash", "generate_audio", "add_metadata", "main"]

# --- CẤU HÌNH ---
API_KEY: str = "AIzaSyDzbBD8W-om1b77m48lsJoaZNHKAIXUpSQ"
VOICE_NAME: str = "vi-VN-Chirp3-HD-Charon"
LANGUAGE_CODE: str = "vi-VN"
INPUT_TSV: str = "output/sentences/viet_patimokkha_segments.tsv"
OUTPUT_DIR: str = "output/sentences/Patimokkha audio_sentences"
TMP_DIR: str = "output/sentences/audio_tmp"
TTS_URL: str = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={API_KEY}"

# Đảm bảo thư mục tồn tại
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)

def slugify(value: str) -> str:
    """Chuẩn hóa chuỗi, chuyển thành chữ thường, loại bỏ ký tự đặc biệt và thay khoảng trắng bằng gạch dưới."""
    val_str: str = str(value)
    val_str = unicodedata.normalize('NFKD', val_str).encode('ascii', 'ignore').decode('ascii')
    val_str = re.sub(r'[^\w\s-]', '', val_str).strip().lower()
    return re.sub(r'[-\s]+', '_', val_str)

def get_audio_hash(text: str) -> str:
    """Trả về mã băm MD5 của đoạn văn bản."""
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def generate_audio(text: str, output_file: str) -> bool:
    """Gọi Google TTS API và lưu file âm thanh."""
    if not text.strip():
        return False
        
    payload: Dict[str, Any] = {
        "input": {"text": text},
        "voice": {"languageCode": LANGUAGE_CODE, "name": VOICE_NAME},
        "audioConfig": {"audioEncoding": "MP3"}
    }
    
    try:
        response: requests.Response = requests.post(TTS_URL, json=payload)
        response.raise_for_status()
        
        content: Optional[str] = response.json().get('audioContent')
        if content:
            with open(output_file, 'wb') as f:
                f.write(base64.b64decode(content))
            return True
        else:
            print(f"⚠️ Lỗi: Không nhận được dữ liệu âm thanh cho text: {text[:50]}...")
            return False
            
    except Exception as e:
        print(f"❌ Lỗi khi sinh audio cho '{text[:50]}...': {e}")
        return False

def add_metadata(filepath: str, lyrics: str, title: str, track_no: str) -> None:
    """Bổ sung Lyrics (USLT), Title (TIT2), Album (TALB), Artist (TPE1), và Track (TRCK) vào MP3."""
    try:
        audio = MP3(filepath, ID3=ID3)
        
        # Thêm ID3 tag nếu chưa có
        if audio.tags is None:
            audio.add_tags()
            
        # Thêm Lyrics (USLT frame)
        audio.tags.add(USLT(encoding=3, lang='vie', desc='', text=lyrics))
        
        # Thêm Title (TIT2 frame)
        audio.tags.add(TIT2(encoding=3, text=title))

        # Thêm Album (TALB frame)
        audio.tags.add(TALB(encoding=3, text="Giới bổn Patimokkha Việt"))

        # Thêm Artist (TPE1 frame)
        audio.tags.add(TPE1(encoding=3, text="Vi-Charon"))

        # Thêm Track Number (TRCK frame)
        audio.tags.add(TRCK(encoding=3, text=track_no))
        
        audio.save()
    except Exception as e:
        print(f"❌ Lỗi thêm metadata vào file {filepath}: {e}")

def main() -> None:
    if not os.path.exists(INPUT_TSV):
        print(f"❌ Lỗi: Không tìm thấy file đầu vào {INPUT_TSV}")
        return

    print(f"Đang xử lý {INPUT_TSV}...")
    
    with open(INPUT_TSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        
        count: int = 0
        skipped: int = 0
        
        for row in reader:
            no_str: str = row.get('no', '').strip()
            heading: str = row.get('heading', '').strip()
            rule_no: str = row.get('rule_no', '').strip()
            segment: str = row.get('segment', '').strip()
            
            if not segment:
                continue
            
            # Đệm số "no" để luôn có 3 chữ số (ví dụ: 001, 023, 150)
            try:
                no_padded: str = f"{int(no_str):03d}"
            except ValueError:
                no_padded = no_str
                
            # Tạo tên file cơ bản
            stub_heading: str = slugify(heading)
            stub_rule: str = slugify(rule_no) if rule_no else ""
            
            filename_base: str = f"{no_padded}_{stub_heading}"
            if stub_rule:
                filename_base += f"_{stub_rule}"
            
            text_hash: str = get_audio_hash(segment)
            tmp_file: str = os.path.join(TMP_DIR, f"{text_hash}.mp3")
            final_file: str = os.path.join(OUTPUT_DIR, f"{filename_base}.mp3")
            
            # Xử lý copy nếu file tạm đã có, ngược lại gọi API tạo mới
            if os.path.exists(tmp_file):
                shutil.copy2(tmp_file, final_file)
                add_metadata(final_file, segment, filename_base, no_padded)
                skipped += 1
            else:
                success: bool = generate_audio(segment, tmp_file)
                if success:
                    shutil.copy2(tmp_file, final_file)
                    add_metadata(final_file, segment, filename_base, no_padded)
                    add_metadata(tmp_file, segment, filename_base, no_padded)
                    count += 1
                    print(f"✅ Đã tạo: {filename_base}.mp3")
                else:
                    print(f"❌ Lỗi khi tạo: {filename_base}")

    print(f"✅ Hoàn tất. Đã tạo mới {count} file. Tái sử dụng {skipped} file cũ.")

if __name__ == "__main__":
    main()