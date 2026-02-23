# Path: scripts/generate_subset_font.py
import os
import subprocess

__all__ = ["main"]

def main() -> None:
    # Đường dẫn file font local đã tải về
    INPUT_FONT: str = "tmp/Noto_Sans_Mono/NotoSansMono-VariableFont_wdth,wght.ttf"
    OUTPUT_DIR: str = "web/public/assets/fonts/noto-sans-mono"
    OUTPUT_FILE: str = f"{OUTPUT_DIR}/noto-sans-mono-pali-viet.woff2"

    # Dải Unicode siêu tối ưu: Basic Latin + Tiếng Việt + Pali
    UNICODES: str = "U+0000-00FF,U+0100-0103,U+0110-0111,U+0128-012B,U+0168-016B,U+01A0-01A1,U+01AF-01B0,U+0300-0309,U+0323,U+0329,U+1E0C-1E0D,U+1E36-1E37,U+1E40-1E47,U+1E6C-1E6D,U+1EA0-1EF9,U+2000-206F,U+20AB"

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if not os.path.exists(INPUT_FONT):
        print(f"❌ Lỗi: Không tìm thấy file font tại {INPUT_FONT}")
        return

    try:
        print("✂️  Đang tiến hành cắt font từ file local...")
        subprocess.run([
            "pyftsubset",
            INPUT_FONT,
            f"--unicodes={UNICODES}",
            "--flavor=woff2",
            "--layout-features=*",
            f"--output-file={OUTPUT_FILE}"
        ], check=True)
        
        size_kb: float = os.path.getsize(OUTPUT_FILE) / 1024
        print(f"✅ Hoàn tất! Đã tạo file font tối ưu tại: {OUTPUT_FILE} (Kích thước: {size_kb:.2f} KB)")
        
    except Exception as e:
        print(f"❌ Lỗi: {e}")

if __name__ == "__main__":
    main()