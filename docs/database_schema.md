# TÀI LIỆU CẤU TRÚC DỮ LIỆU (DATABASE SCHEMA)

Tài liệu này mô tả cấu trúc của file SQLite `web/public/app-content/content.db`. Dữ liệu được thiết kế theo mô hình quan hệ (Relational DB) để tối ưu cho việc tìm kiếm, phân loại và hiển thị.

## 1. Cấu trúc Bảng `contents` (Bảng trung tâm)

Bảng này chứa toàn bộ nội dung hiển thị của ứng dụng. Mỗi dòng tương ứng với một đoạn văn bản (segment).

| Cột | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **`uid`** | `INTEGER PRIMARY KEY` | ID duy nhất, tăng dần tuần tự. |
| **`html`** | `TEXT` | Khuôn mẫu HTML (VD: `<p>{}</p>`). Có chứa placeholder `{}` để ghép nội dung. |
| **`label`** | `TEXT` | Nhãn phân loại gốc (VD: `pj1-name`, `tiensu`). |
| **`segment`** | `TEXT` | **Văn bản thuần túy (Raw Text)**. Không chứa thẻ HTML. Dùng cho Tìm kiếm và TTS. |
| **`segment_html`** | `TEXT` | **Văn bản hiển thị (Rich Text)**. Đã được bọc sẵn các thẻ CSS (`<b>`, `.quote-text`, `.hint-tail`, `.selection-group`). |
| **`has_hint`** | `INTEGER` | (0/1) Xác định đoạn này có hỗ trợ tính năng Học thuộc lòng hay không. |
| **`audio_name`** | `TEXT` | Tên file âm thanh (nếu có). |
| **`heading_id`** | `INTEGER` | (Khóa ngoại) Liên kết đến bảng `headings`. Chỉ ra đoạn này đang nằm dưới tiêu đề nào. |
| **`rule_id`** | `TEXT` | (Khóa ngoại) Liên kết đến bảng `rules`. Chỉ ra đoạn này thuộc về điều luật nào (nếu có). |

## 2. Cấu trúc Bảng `rules` (Bảng phân loại Luật)

Bảng này lưu trữ thông tin về các Chương/Nhóm luật và các Điều luật cụ thể.

| Cột | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **`id`** | `TEXT PRIMARY KEY` | Mã định danh (VD: `ss` cho nhóm Tăng tàn, `ss1` cho luật Tăng tàn 1). |
| **`type`** | `INTEGER` | `0`: Nhóm luật (Group/Chapter). `1`: Điều luật cụ thể (Rule). |
| **`pali`** | `TEXT` | Tên tiếng Pali (VD: *Saṅghādisesa*, *Sukkavissaṭṭhi*). |
| **`viet`** | `TEXT` | Tên tiếng Việt. |
| **`group`** | `TEXT` | (Khóa ngoại tự tham chiếu) Mã `id` của nhóm cha (chỉ áp dụng cho type=1). |

## 3. Cấu trúc Bảng `headings` (Bảng Mục lục & Cây phân cấp)

Bảng này chứa thông tin về cấu trúc cây Mục lục (TOC) được trích xuất từ các thẻ `<h1>` - `<h6>`.

| Cột | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| **`uid`** | `INTEGER PRIMARY KEY` | Trùng với `uid` trong bảng `contents`. |
| **`text`** | `TEXT` | Nội dung văn bản của tiêu đề. |
| **`level`** | `INTEGER` | Cấp độ tiêu đề (1 đến 6). |
| **`parent_uid`** | `INTEGER` | (Khóa ngoại tự tham chiếu) `uid` của tiêu đề cha gần nhất. |
| **`breadcrumbs`** | `TEXT` | Chuỗi phân cấp có sẵn (VD: `GIỚI BỔN > TIỀN SỰ > Công Việc Chuẩn Bị`). Giúp Frontend hiển thị ngay đường dẫn gốc mà không cần JOIN đệ quy. |

## 4. Lưu trữ File Audio

Toàn bộ file âm thanh được lưu trữ tại `web/public/app-content/audio/` và được đóng gói vào `audio.zip`. 
Ứng dụng tải ngầm `audio.zip`, giải nén và đưa vào **Service Worker Cache** để phát offline.

## 5. Hướng dẫn sử dụng cho Frontend

- **Hiển thị giao diện đọc:** Vẫn query bảng `contents` theo `uid`.
- **Tìm kiếm nâng cao:** Query cột `segment` trong bảng `contents`, sau đó lấy `heading_id` và `rule_id` để JOIN sang hai bảng còn lại nhằm hiển thị cho người dùng biết đoạn văn vừa tìm được nằm ở chương nào, thuộc luật gì.
- **Xây dựng Mục lục (TOC):** Thay vì phải duyệt qua toàn bộ `contents`, chỉ cần query trực tiếp bảng `headings` để dựng cây thư mục siêu nhanh.
