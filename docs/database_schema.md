# TÀI LIỆU CẤU TRÚC DỮ LIỆU (DATABASE SCHEMA)

Tài liệu này mô tả cấu trúc của file SQLite `web/public/app-content/content.db` (và bản sao gốc tại `data/content/content.tsv`). Dữ liệu được thiết kế tối ưu, chỉ lưu trữ Text trong DB, trong khi Audio được tách riêng thành các file mp3 (và được gói vào `audio.zip` để tải ngầm) nhằm ngăn chặn lỗi tràn RAM trên iOS.

## 1. Cấu trúc Bảng `contents` (Bảng duy nhất)

Bảng này chứa nội dung để load lên giao diện UI. Rất nhẹ và truy xuất cực nhanh.

| Cột | Kiểu dữ liệu (SQLite) | Mô tả |
| :--- | :--- | :--- |
| **`uid`** | `INTEGER PRIMARY KEY` | ID duy nhất, tăng dần tuần tự từ trên xuống dưới. |
| **`html`** | `TEXT` | Khuôn mẫu HTML định dạng sẵn. Có chứa placeholder `{}` để Frontend ghép nội dung. |
| **`label`** | `TEXT` | Nhãn phân loại nội dung, dùng để xác định vị trí, gom nhóm TOC hoặc xác định logic xử lý. |
| **`segment`** | `TEXT` | Nội dung văn bản thô. |
| **`audio_name`** | `TEXT` | Tên file âm thanh tương ứng (VD: `abc123def.mp3`). Frontend sẽ dùng tên này để fetch file MP3. Nếu là `skip` thì bỏ qua. |
| **`hint`** | `TEXT` | Nội dung văn bản đã được xử lý (VD: bọc thẻ HTML dùng cho Hint Mode, chỉ hiện chữ cái đầu). |

## 2. Lưu trữ File Audio (Không còn nằm trong DB)

Để giải quyết triệt để vấn đề Jetsam Memory Limit (OOM) trên Safari iOS, các dữ liệu Audio Blob không còn được lưu trong bảng SQLite.
Thay vào đó, các file `.mp3` được lưu trực tiếp tại `web/public/app-content/audio/`.
Khi tải ứng dụng, file `web/public/app-content/audio.zip` chứa toàn bộ âm thanh sẽ được tải ngầm (Background Fetch), sau đó giải nén và đưa thẳng vào **Service Worker Cache** (Cache Storage). Điều này giúp phát Audio offline tức thì mà không cần tiêu tốn RAM để load Blob từ DB.

## 3. Hướng dẫn sử dụng cho Frontend

- **Để Load UI:** Truy vấn lấy ra `uid, html, label, segment, audio_name, hint` từ bảng `contents`. **Lưu ý: Luôn dùng `WHERE uid > ? LIMIT ?` thay cho `OFFSET` để SQLite tận dụng Index, đảm bảo hiệu năng và tránh OOM**.
- **Để Phát Audio:** Lấy `audio_name` từ bước trên (nếu khác `skip`) và khởi tạo trình phát âm thanh fetch tới URL: `/app-content/audio/{audio_name}`. Trình duyệt/Service Worker sẽ tự động hứng (intercept) request này và trả về file âm thanh (đã được lưu sẵn trong Cache).
