# Biến số
PYTHON = python3
NPM = npm
# Lấy địa chỉ IP nội bộ (LAN) - hỗ trợ macOS và Linux
LOCAL_IP = $(shell ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $$2}' | head -n 1)
# Base URL từ cấu hình dự án
BASE_URL = /gioibon/

.PHONY: data icons dev simple build preview deploy clean setup help qr-dev qr-preview merge

# Biến Git (Dùng cho lệnh merge)
BRANCH ?= $(shell git rev-parse --abbrev-ref HEAD)

# Lệnh mặc định
help:
	@echo "Các lệnh có sẵn:"
	@echo "  make data      : Xây dựng dữ liệu SQLite từ Markdown"
	@echo "  make icons     : Sinh bộ icons PWA (yêu cầu Pillow)"
	@echo "  make dev       : Chạy Vite dev server (có QR Code mạng LAN)"
	@echo "  make simple    : Chạy Python HTTP Server đơn giản (Port 3456)"
	@echo "  make merge     : Merge nhánh hiện tại vào main và xóa nhánh (vd: make merge BRANCH=feature/hinting)"
	@echo "  make build     : Build bản production cho Web"
	@echo "  make preview   : Xem trước bản build cục bộ (có QR Code mạng LAN)"
	@echo "  make deploy    : Build và Deploy lên GitHub Pages"
	@echo "  make clean     : Dọn dẹp cache và thư mục build"
	@echo "  make setup     : Cài đặt dependencies (NPM & Pip)"

# Git Utilities
merge:
	@if [ "$(BRANCH)" = "main" ]; then echo "❌ Lỗi: Bạn đang ở nhánh main. Hãy chỉ định nhánh cần merge (vd: make merge BRANCH=feature/abc)"; exit 1; fi
	@echo "🔄 Đang merge nhánh [$(BRANCH)] vào main..."
	git checkout main
	git merge $(BRANCH)
	git branch -d $(BRANCH)
	@echo "✅ Đã merge và xóa nhánh [$(BRANCH)] thành công."

# Backend & Data
data:
	$(PYTHON) src/main.py data

icons:
	$(PYTHON) scripts/generate_pwa_icons.py

simple:
	@echo "🚀 Khởi chạy Browser-sync Server tại http://localhost:3456"
	@echo "✨ CSS Injection: ✅ | Auto-reload: ✅ | Multi-root: ✅"
	npx browser-sync start --server "web" --serveStatic "web/public" --files "web/**/*" --port 3456 --no-notify --no-ui

# Frontend
dev:
	@echo "📱 Quét mã QR để mở trên điện thoại (LAN):"
	@npx qrcode "https://$(LOCAL_IP):5173$(BASE_URL)" -e L --small
	$(NPM) run dev -- --host

preview:
	@echo "📱 Quét mã QR để xem trước trên điện thoại (LAN):"
	@npx qrcode "https://$(LOCAL_IP):4173$(BASE_URL)" -e L --small
	$(NPM) run preview -- --host

build:
	$(NPM) run build

deploy: build
	$(NPM) run deploy

# Tiện ích
setup:
	$(NPM) install
	$(NPM) install --save-dev @vitejs/plugin-basic-ssl
	pip install Pillow requests mutagen

clean:
	rm -rf dist/
	rm -rf build/
	rm -rf .venv/
	find . -type d -name "__pycache__" -exec rm -rf {} +
	@echo "✅ Đã dọn dẹp sạch sẽ."