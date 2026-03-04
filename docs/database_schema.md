# TÀI LIỆU CẤU TRÚC DỮ LIỆU (DATABASE SCHEMA)

Tài liệu này mô tả cấu trúc của file SQLite `web/public/app-content/content.db` (và bản sao gốc tại `data/content/content.tsv`). Dữ liệu được thiết kế tối ưu, tách biệt giữa nội dung thô (để tìm kiếm) và nội dung HTML (để hiển thị).

## 1. Cấu trúc Bảng `contents` (Bảng duy nhất)

Bảng này chứa toàn bộ nội dung của ứng dụng.

| Cột | Kiểu dữ liệu (SQLite) | Mô tả |
| :--- | :--- | :--- |
| **`uid`** | `INTEGER PRIMARY KEY` | ID duy nhất, tăng dần tuần tự. |
| **`html`** | `TEXT` | Khuôn mẫu HTML (VD: `<p>{}</p>`). Có chứa placeholder `{}` để ghép nội dung. |
| **`label`** | `TEXT` | Nhãn phân loại (VD: `pj1-name`, `tiensu`). |
| **`segment`** | `TEXT` | **Văn bản thuần túy (Raw Text)**. Không chứa bất kỳ thẻ HTML nào. Dùng cho tính năng Tìm kiếm và TTS. |
| **`segment_html`** | `TEXT` | **Văn bản hiển thị (Rich Text)**. Đã được Backend xử lý sẵn các thẻ `<b>`, `<span>` cho trích dẫn và Hint Mode. |
| **`has_hint`** | `INTEGER` | Cờ hiệu (0 hoặc 1). Xác định đoạn này có hỗ trợ tính năng Học thuộc lòng hay không. |
| **`audio_name`** | `TEXT` | Tên file âm thanh tương ứng (VD: `abc123def.mp3`). Nếu là `skip` thì bỏ qua. |

## 2. Lưu trữ File Audio

Toàn bộ file âm thanh được lưu trữ tại `web/public/app-content/audio/` và được đóng gói vào `audio.zip`. 
Ứng dụng tải ngầm `audio.zip`, giải nén và đưa vào **Service Worker Cache** để phát offline mượt mà trên iOS mà không gây tràn RAM.

## 3. Hướng dẫn sử dụng cho Frontend

- **Để Hiển thị UI:** Truy vấn lấy `uid, html, label, segment_html, has_hint`. Dùng `segment_html` để thay vào placeholder của `html`.
- **Để Tìm kiếm:** Sử dụng cột `segment` để thực hiện câu lệnh `LIKE` hoặc `MATCH` (FTS), tránh được việc bị nhiễu bởi các thẻ HTML.
- **Để Phát Audio:** Lấy `audio_name` và fetch tới URL: `/app-content/audio/{audio_name}`.
