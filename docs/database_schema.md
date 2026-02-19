# TÀI LIỆU CẤU TRÚC DỮ LIỆU (DATABASE SCHEMA)

Tài liệu này mô tả cấu trúc của file SQLite `web/data/content.db` (và bản sao `data/content/content.tsv`). Dữ liệu được thiết kế theo dạng **Flat Structure (Bảng Phẳng)** để tối ưu hóa cho việc truy vấn và render giao diện Frontend.

## 1. Cấu trúc Bảng `contents`

Bảng `contents` bao gồm các cột sau:

| Cột | Kiểu dữ liệu (SQLite) | Mô tả |
| :--- | :--- | :--- |
| **`uid`** | `INTEGER PRIMARY KEY` | ID duy nhất, tăng dần tuần tự từ trên xuống dưới. |
| **`html`** | `TEXT` | Khuôn mẫu HTML định dạng sẵn. Có chứa placeholder `{}` để Frontend ghép nội dung. |
| **`label`** | `TEXT` | Nhãn phân loại nội dung, dùng để xác định vị trí, gom nhóm TOC hoặc xác định logic xử lý. |
| **`segment`** | `TEXT` | Nội dung văn bản thô (có thể chứa các ký tự định dạng markdown như `**` hoặc `<br>`). |
| **`audio`** | `TEXT` | Tên file âm thanh tương ứng nằm trong thư mục `web/data/audio/`. |

## 2. Hướng dẫn sử dụng các Cột cho Frontend

### 2.1. Render Nội dung (`html` + `segment`)
Để render ra giao diện, Frontend KHÔNG bao giờ in trực tiếp `segment` ra màn hình, mà phải thực hiện việc "trám" `segment` vào bên trong `html`.
- **Ví dụ Data:** `html` = `<p class='endvagga'>{}</p>`, `segment` = `_Phẩm Y là thứ nhất._`
- **Kết quả DOM:** `<p class='endvagga'>_Phẩm Y là thứ nhất._</p>`

**Lưu ý về CSS Classes được Backend tiêm sẵn trong `html`:**
- `<h1 class="title">`: Tiêu đề chính.
- `<h2 class="subtitle">`: Tiêu đề phụ.
- `<p class="note">`: Đoạn ghi chú.
- `<p class="endvagga">`: Dòng kết thúc một Phẩm.
- `<p class="endsection">`: Dòng kết thúc một Chương/Phần.
- `<p class="endsutta">`: Dòng kết thúc toàn bộ Giới Bổn.
- `<p class="sadhu">`: Câu cảm thán Sādhu ở cuối bài.

### 2.2. Xử lý Audio (`audio`)
- Cột `audio` chứa tên file MP3 (ví dụ: `001_title__a1b2c3d4e5f6g7h8.mp3`). Frontend sẽ nối với đường dẫn `data/audio/` để phát nhạc.
- **NGOẠI LỆ QUAN TRỌNG:** Nếu `audio` có giá trị là **`"skip"`**, điều này có nghĩa là segment đó KHÔNG CÓ âm thanh (thường là tiêu đề tiếng Pali hoặc Ghi chú). Frontend phải thiết lập logic **bỏ qua việc phát âm thanh** ở những segment này trong tính năng Auto-Play.

### 2.3. Hệ thống Nhãn (`label`)
Hệ thống `label` được chuẩn hóa bằng Lowercase và không có khoảng trắng. Frontend dựa vào đây để xây dựng Bảng Mục Lục (TOC) và điều hướng.

**Nhãn Cấu Trúc Chung:**
- `title`, `subtitle`: Tiêu đề dự án.
- `note-{uid}`: Ghi chú giải thích cho segment có `uid` liền trước nó (Ví dụ: `note-14` là giải thích cho `uid: 14`).
- `nidana`, `end`: Các đoạn mở đầu và kết thúc không thuộc về Giới luật cụ thể.

**Nhãn Giới Luật (Rules):**
Mỗi loại giới luật có một Prefix riêng: `pj` (Triệt khai), `ss` (Tăng tàng), `ay` (Bất định), `np` (Ưng xả đối trị), `pc` (Ưng đối trị), `pd` (Ưng phát lộ), `sk` (Ưng học pháp), `as` (Dàn xếp).
Cấu trúc hậu tố đi kèm Prefix:
- `{prefix}-opening`: Đoạn dẫn nhập của chương đó.
- `{prefix}-chapter`: Tên các "Phẩm" nằm bên trong chương.
- `{prefix}{number}-name`: Tên Tiếng Pali của điều luật (Ví dụ: `pj1-name`). Segment này được chèn bằng thẻ `<h3>` và audio luôn là `"skip"`.
- `{prefix}{number}`: Nội dung chính của điều luật (Ví dụ: `pj1`, `ss6`).
- `{prefix}-ending`: Đoạn tổng kết ở cuối mỗi chương.

---
**Tóm tắt cho AI Frontend Assistant:**
Khi viết code render hoặc xử lý Audio, hãy dựa vào `label` để phân nhóm các Rule (ví dụ gom tất cả `pj1` và `pj1-name` vào chung một block nếu cần), dùng `html.replace('{}', segment)` để render DOM, và check `if (audio === 'skip')` để xử lý trình phát nhạc chính xác.

