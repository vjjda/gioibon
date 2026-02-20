# Path: scripts/simple_server.py
import http.server
import socketserver
import os
import sys
import urllib.parse

PORT = 3456
# Đảm bảo ta lấy đúng thư mục gốc của dự án
PROJECT_ROOT = os.getcwd()
WEB_DIR = os.path.join(PROJECT_ROOT, 'web')
PUBLIC_DIR = os.path.join(WEB_DIR, 'public')

class SmartHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # 1. Giải mã URL (xử lý %20, v.v.) và loại bỏ query string
        url_path = urllib.parse.urlparse(path).path
        relative_path = url_path.lstrip('/')
        
        # 2. Thử tìm trong thư mục web/ (thư mục root của server)
        web_file = os.path.join(WEB_DIR, relative_path)
        if os.path.exists(web_file) and not os.path.isdir(web_file):
            return web_file
            
        # 3. Thử tìm trong thư mục web/public/ (ánh xạ giống Vite)
        public_file = os.path.join(PUBLIC_DIR, relative_path)
        if os.path.exists(public_file) and not os.path.isdir(public_file):
            # print(f"  [DEBUG] Found in public: {relative_path}")
            return public_file
            
        # 4. Mặc định trả về đường dẫn trong web/ (để super() xử lý 404 hoặc index.html)
        return web_file

    def end_headers(self):
        # Vô hiệu hóa cache hoàn toàn để dev CSS/JS mượt mà
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
        super().end_headers()

    def log_message(self, format, *args):
        # Ghi log gọn nhẹ hơn
        path = args[0] if len(args) > 0 else ""
        code = args[1] if len(args) > 1 else ""
        if "404" in str(code):
            print(f"  ❌ 404: {path}")
        else:
            # Chỉ log các file quan trọng
            if any(path.endswith(ext) for ext in ['.js', '.css', '.wasm', '.json', '.db']):
                print(f"  ✅ {code}: {path}")

def run_server():
    if not os.path.exists(WEB_DIR):
        print(f"❌ Lỗi: Không tìm thấy thư mục {WEB_DIR}")
        sys.exit(1)

    # Cập nhật MIME Types
    SmartHandler.extensions_map.update({
        '.wasm': 'application/wasm',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.ico': 'image/x-icon'
    })

    # Chạy server từ thư mục web/
    os.chdir(WEB_DIR)

    try:
        # socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(("", PORT), SmartHandler) as httpd:
            print(f"🚀 Smart Dev Server: http://localhost:{PORT}")
            print(f"📂 Serving from: {WEB_DIR}")
            print(f"✨ Mapping: / -> web/public/ (Vite-style)")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Đã dừng server.")
    except Exception as e:
        print(f"❌ Lỗi server: {e}")

if __name__ == "__main__":
    run_server()
