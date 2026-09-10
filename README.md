# App Test — Giao việc giữa các bộ phận

App độc lập, chạy riêng để test trước khi liên kết với HUB & MG / GASKET.

## Cách chạy

```
npm install
npm start
```

Sau đó mở trình duyệt: **http://localhost:4000**

Server mặc định chạy ở cổng 4000. Muốn đổi cổng: `PORT=5000 npm start`

> Nếu đã cài lần trước, chạy lại `npm install` để cài thêm thư viện `multer` (dùng cho tính năng đính kèm file).

## Đã có sẵn

- 5 bộ phận mặc định: Kho, Khuôn, QC, Kỹ thuật, Sản xuất — thêm/sửa/xoá được ngay trên giao diện (cột trái)
- Giao việc cho 1 người cụ thể (gõ tên) hoặc 1 bộ phận (chọn từ danh sách)
- **File đính kèm** (nhiều file, tối đa 15MB/file) — lưu vào thư mục `uploads/`, xoá task sẽ tự xoá luôn file vật lý
- **Liên kết tham khảo** — thêm nhiều link, mỗi link 1 dòng
- Nút bấm theo từng bước (Nhận việc → Bắt đầu làm → Hoàn thành...), có popup xem mô tả + file/link đính kèm trước khi xác nhận
- Ghi lại thời gian ở mỗi bước (giao/nhận/bắt đầu/hoàn thành) và tính thời gian xử lý
- Dữ liệu lưu vào file `data.json` (tự tạo khi chạy lần đầu) — xoá file này để reset về mặc định

## Cấu trúc file

- `server.js` — Express server, các API `/api/departments` và `/api/tasks`
- `database.js` — Lưu trữ bằng file JSON (đơn giản, không cần cài database ngoài)
- `index.html` — Giao diện, gọi thẳng vào API cùng server

## Khi tích hợp với HUB & MG / GASKET

Vì 2 app đó đang chạy trên 2 server hoàn toàn khác nhau, cách gọn nhất là:
- Deploy app này lên 1 địa chỉ cố định (VD: `https://tasks.yourdomain.com`)
- Cả 2 app kia gọi thẳng vào các API `/api/departments`, `/api/tasks` của app này qua `fetch()`
- CORS đã được bật sẵn (`app.use(cors())`) cho phép gọi từ domain khác — khi lên thật nên giới hạn lại danh sách domain cụ thể trong `server.js` để an toàn hơn:
  ```js
  app.use(cors({ origin: ['https://hubmg.yourdomain.com', 'https://gasket.yourdomain.com'] }));
  ```
- Có thể thêm field `sourceApp` khi tạo task (đã có sẵn trong schema) để phân biệt task tạo từ app nào

## Đổi sang database thật (không bắt buộc)

Hiện tại dùng file JSON cho đơn giản. Nếu dữ liệu nhiều/cần chạy nhiều instance cùng lúc, có thể thay `database.js` bằng SQLite (`better-sqlite3`) hoặc MySQL mà không cần đổi `server.js` — chỉ cần giữ nguyên các hàm export (`getDepartments`, `addTask`,...).
