# Biến số
PYTHON = python3
NPM = npm

.PHONY: data icons dev build preview deploy clean setup help

# Lệnh mặc định
help:
	@echo "Các lệnh có sẵn:"
	@echo "  make data      : Xây dựng dữ liệu SQLite từ Markdown"
	@echo "  make icons     : Sinh bộ icons PWA (yêu cầu Pillow)"
	@echo "  make dev       : Chạy Vite dev server"
	@echo "  make build     : Build bản production cho Web"
	@echo "  make preview   : Xem trước bản build cục bộ"
	@echo "  make deploy    : Build và Deploy lên GitHub Pages"
	@echo "  make clean     : Dọn dẹp cache và thư mục build"
	@echo "  make setup     : Cài đặt dependencies (NPM & Pip)"

# Backend & Data
data:
	$(PYTHON) src/main.py data

icons:
	$(PYTHON) scripts/generate_pwa_icons.py

# Frontend
dev:
	$(NPM) run dev

build:
	$(NPM) run build

preview:
	$(NPM) run preview

deploy: build
	$(NPM) run deploy

# Tiện ích
setup:
	$(NPM) install
	pip install Pillow requests mutagen

clean:
	rm -rf dist/
	rm -rf build/
	rm -rf .venv/
	find . -type d -name "__pycache__" -exec rm -rf {} +
	@echo "✅ Đã dọn dẹp sạch sẽ."
