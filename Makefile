# Biến số
PYTHON = python3
NPM = npm
# Lấy địa chỉ IP nội bộ (LAN) - hỗ trợ macOS và Linux
LOCAL_IP = $(shell ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $$2}' | head -n 1)
# Base URL từ cấu hình dự án
BASE_URL = /gioibon/

.PHONY: data icons dev simple build preview deploy clean setup help qr-dev qr-preview merge amend

# Biến Git (Dùng cho lệnh merge)
BRANCH ?= $(shell git rev-parse --abbrev-ref HEAD)

# Lệnh mặc định
help:
	@echo "Các lệnh có sẵn:"
	@echo "  make data      : Xây dựng dữ liệu SQLite từ Markdown"
	@echo "  make data-clean: Xây dựng dữ liệu và dọn dẹp audio rác"
	@echo "  make icons     : Sinh bộ icons PWA (yêu cầu Pillow)"
	@echo "  make dev       : Chạy Vite dev server (có QR Code mạng LAN)"
	@echo "  make simple    : Chạy Python HTTP Server đơn giản (Port 3456)"
	@echo "  make merge     : Merge nhánh hiện tại vào main và xóa nhánh (vd: make merge BRANCH=feature/hinting)"
	@echo "  make amend     : Gộp nhanh thay đổi vào commit gần nhất (add . && amend)"
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

amend:
	@echo "🔄 Đang gộp thay đổi vào commit cuối..."
	git add .
	git commit --amend --no-edit
	@echo "✅ Đã amend thành công."

# Backend & Data
data:
	$(PYTHON) src/main.py data $(ARGS)

data-clean:
	$(PYTHON) src/main.py data --clean

icons:
	$(PYTHON) scripts/generate_pwa_icons.py

simple:
	@echo "🚀 Khởi chạy Browser-sync Server tại http://localhost:3456"
	@echo "✨ CSS Injection: ✅ | Auto-reload: ✅ | Multi-root: ✅ | WASM MIME: ✅"
	npx browser-sync start --config bs-config.js

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
	mkdir -p web/public/libs/wa-sqlite && cp node_modules/@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm web/public/libs/wa-sqlite/wa-sqlite-async.wasm
	pip install Pillow requests mutagen

clean:
	rm -rf dist/
	rm -rf build/
	rm -rf .venv/
	find . -type d -name "__pycache__" -exec rm -rf {} +
	@echo "✅ Đã dọn dẹp sạch sẽ."

