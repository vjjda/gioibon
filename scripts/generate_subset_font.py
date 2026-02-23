#!/usr/bin/env python3
# Path: scripts/generate_subset_font.py
import os
import subprocess
import sys

__all__ = ["main"]

def main() -> None:
    """
    Cắt subset cho font Noto Sans Mono để tối ưu hóa việc hiển thị tiếng Việt và Pali.
    Dung lượng mục tiêu: < 100KB.
    """
    # Đường dẫn file font gốc (Variable Font)
    INPUT_FONT: str = "tmp/Noto_Sans_Mono/NotoSansMono-VariableFont_wdth,wght.ttf"
    OUTPUT_DIR: str = "web/public/assets/fonts/noto-sans-mono"
    OUTPUT_FILE: str = f"{OUTPUT_DIR}/noto-sans-mono-pali-viet.woff2"

    # Dải Unicode: Basic Latin + Tiếng Việt + Pali
    UNICODES: str = (
        "U+0000-00FF,"  # Basic Latin
        "U+0100-0103,U+0110-0111,U+0128-012B,U+0168-016B," # Latin Extended (Pali/Viet)
        "U+01A0-01A1,U+01AF-01B0," # Latin Extended-B
        "U+0300-0309,U+0323,U+0329," # Combining Diacritical Marks
        "U+1E0C-1E0D,U+1E36-1E37,U+1E40-1E47,U+1E6C-1E6D," # Latin Extended Additional (Pali)
        "U+1EA0-1EF9," # Latin Extended Additional (Vietnamese)
        "U+2000-206F," # General Punctuation
        "U+20AB"       # Đồng Sign
    )

    if not os.path.exists(os.path.dirname(OUTPUT_FILE)):
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    if not os.path.exists(INPUT_FONT):
        print(f"❌ Lỗi: Không tìm thấy file font gốc tại {INPUT_FONT}")
        return

    try:
        print(f"✂️  Đang tiến hành cắt subset font từ: {INPUT_FONT}")
        
        # Sử dụng pyftsubset (thuộc gói fonttools)
        # Các flag bổ sung:
        # --flavor=woff2: Nén định dạng woff2
        # --layout-features='*': Giữ lại các tính năng Opentype (kerning, ligatures)
        # --desubroutinize: Tối ưu hóa cấu trúc font (giảm dung lượng)
        args = [
            "pyftsubset",
            INPUT_FONT,
            f"--unicodes={UNICODES}",
            "--flavor=woff2",
            "--layout-features=*",
            "--desubroutinize",
            f"--output-file={OUTPUT_FILE}"
        ]

        subprocess.run(args, check=True)
        
        size_kb: float = os.path.getsize(OUTPUT_FILE) / 1024
        print(f"✅ Hoàn tất! Đã tạo file font tối ưu tại: {OUTPUT_FILE}")
        print(f"📊 Kích thước file: {size_kb:.2f} KB")
        
        if size_kb > 150:
            print("⚠️  Cảnh báo: File font vẫn hơi lớn. Hãy kiểm tra lại các dải Unicode.")
        else:
            print("✨ Kích thước font rất tốt cho việc sử dụng trên Web.")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Lỗi thực thi pyftsubset: {e}")
    except Exception as e:
        print(f"❌ Lỗi không xác định: {e}")

if __name__ == "__main__":
    main()