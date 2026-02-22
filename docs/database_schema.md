# TÀI LIỆU CẤU TRÚC DỮ LIỆU (DATABASE SCHEMA)

Tài liệu này mô tả cấu trúc của file SQLite `web/data/content.db` (và bản sao `data/content/content.tsv`). Dữ liệu được thiết kế tối ưu, bóc tách giữa Text và Binary Blob để ngăn chặn lỗi tràn RAM trên iOS.

## 1. Cấu trúc Bảng `contents` (Bảng Text)

Bảng này chứa nội dung để load lên giao diện UI. Rất nhẹ và truy xuất cực nhanh.

| Cột | Kiểu dữ liệu (SQLite) | Mô tả |
| :--- | :--- | :--- |
| **`uid`** | `INTEGER PRIMARY KEY` | ID duy nhất, tăng dần tuần tự từ trên xuống dưới. |
| **`html`** | `TEXT` | Khuôn mẫu HTML định dạng sẵn. Có chứa placeholder `{}` để Frontend ghép nội dung. |
| **`label`** | `TEXT` | Nhãn phân loại nội dung, dùng để xác định vị trí, gom nhóm TOC hoặc xác định logic xử lý. |
| **`segment`** | `TEXT` | Nội dung văn bản thô. |
| **`hint`** | `TEXT` | Nội dung văn bản đã được bọc thẻ HTML dùng cho Hint Mode. |
| **`audio_name`** | `TEXT` | Tên file âm thanh, đóng vai trò như Foreign Key liên kết sang bảng `audios`. |

## 2. Cấu trúc Bảng `audios` (Bảng File Nhị Phân)

Bảng này đóng vai trò như kho lưu trữ file. Frontend chỉ gọi query vào bảng này khi người dùng chủ động bấm Play Audio để tiết kiệm bộ nhớ.

| Cột | Kiểu dữ liệu (SQLite) | Mô tả |
| :--- | :--- | :--- |
| **`audio_name`** | `TEXT PRIMARY KEY` | Trùng khớp với tên file `.mp3` (VD: `abc123def.mp3`). |
| **`audio_blob`** | `BLOB` | Dữ liệu nhị phân file MP3 gốc. |

## 3. Hướng dẫn sử dụng cho Frontend

- Để Load UI: Chạy vòng lặp lấy ra `uid, html, label, hint, audio_name` từ bảng `contents`. **Lưu ý: Dùng `WHERE uid > ? LIMIT ?` thay cho `OFFSET` để SQLite tận dụng Index và không bị OOM**.
- Để Phát Audio: Dùng `audio_name` lấy từ bước trên để query thẳng `SELECT audio_blob FROM audios WHERE audio_name = ?`.

