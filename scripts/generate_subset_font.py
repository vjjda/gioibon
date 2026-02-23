# Path: scripts/generate_subset_font.py
import os
import subprocess
import requests

def main():
    # 1. URL tải file Noto Sans Mono (Variable Font) bản đầy đủ gốc từ GitHub của Google
    FONT_URL = "https://github.com/notofonts/latin-greek-cyrillic/raw/main/fonts/NotoSansMono/unhinted/variable/NotoSansMono-VF.ttf"
    TMP_FONT = "NotoSansMono-Full.ttf"
    OUTPUT_DIR = "web/public/assets/fonts/noto-sans-mono"
    OUTPUT_FILE = f"{OUTPUT_DIR}/noto-sans-mono-pali-viet.woff2"

    # Dải Unicode siêu tối ưu chỉ chứa đúng: Basic Latin + Tiếng Việt + Pali
    # U+0000-00FF: Basic Latin (English, số, dấu câu, Ññ)
    # U+0102...: Tiếng Việt
    # U+0100-0101, U+012A... : Āā, Īī, Ūū, Ḍḍ, Ḷḷ, Ṁṁ, Ṃṃ, Ṅṅ, Ṇṇ, Ṭṭ
    UNICODES = "U+0000-00FF,U+0100-0103,U+0110-0111,U+0128-012B,U+0168-016B,U+01A0-01A1,U+01AF-01B0,U+0300-0309,U+0323,U+0329,U+1E0C-1E0D,U+1E36-1E37,U+1E40-1E47,U+1E6C-1E6D,U+1EA0-1EF9,U+2000-206F,U+20AB"

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("⬇️  Đang tải font Noto Sans Mono bản Full...")
    response = requests.get(FONT_URL)
    with open(TMP_FONT, 'wb') as f:
        f.write(response.content)

    print("✂️  Đang tiến hành cắt font (Subsetting)...")
    try:
        # Sử dụng pyftsubset từ thư viện fonttools
        subprocess.run([
            "pyftsubset",
            TMP_FONT,
            f"--unicodes={UNICODES}",
            "--flavor=woff2",
            "--layout-features=*",
            f"--output-file={OUTPUT_FILE}"
        ], check=True)
        
        size_kb = os.path.getsize(OUTPUT_FILE) / 1024
        print(f"✅ Hoàn tất! Đã tạo file font tối ưu tại: {OUTPUT_FILE} (Kích thước: {size_kb:.2f} KB)")
        
    except Exception as e:
        print(f"❌ Lỗi khi cắt font: {e}")
    finally:
        if os.path.exists(TMP_FONT):
            os.remove(TMP_FONT)

if __name__ == "__main__":
    main()

