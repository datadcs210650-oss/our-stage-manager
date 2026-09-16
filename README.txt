OUR STAGE CLUB MANAGER V34 — EVENT FIELDS FIX

ĐÃ SỬA LỖI CỔNG SỰ KIỆN KHÔNG HIỆN CÂU HỎI

Nguyên nhân chính:
- Một số sự kiện cũ / sự kiện bị lỗi có fields = [] hoặc không có fields trong Firestore.
- Khi mở chỉnh sửa, mảng rỗng được xem như cấu hình hợp lệ nên giao diện builder tiếp tục giữ rỗng.
- Cổng public vì vậy chỉ hiện tiêu đề + nút “Gửi thông tin”, không có ô nhập.

V34 xử lý 4 lớp:

1. EVENT BUILDER
- Nếu event.fields bị thiếu/rỗng, builder tự tạo bộ trường mặc định.
- Đóng quỹ mặc định:
  + Họ và tên
  + MSSV
  + Xác nhận
- Form thường mặc định:
  + Họ và tên
  + MSSV
  + Email
- Tất cả trường luôn được chuẩn hóa và có id trước khi lưu.

2. KHÔI PHỤC EVENT CŨ
- Card sự kiện hiển thị số trường.
- Nếu một event bị mất fields, card hiển thị “Thiếu trường”.
- Có nút “Khôi phục trường”.
- Khi mở menu Cổng sự kiện, Admin cũng tự kiểm tra và sửa event bị rỗng trong Firestore.

3. PUBLIC FORM
- su-kien.html có fallback riêng.
- Nếu Firestore event cũ chưa có fields, trang public vẫn dựng trường mặc định thay vì hiện form trống.
- Khi Admin vào hệ thống, cấu hình đó sẽ được sửa lại vào Firestore.

4. CÔNG CỤ BUILDER
- Nút “Khôi phục trường mặc định”.
- Nút “Xem trước form”.
- Khi lưu, hệ thống kiểm tra lại toàn bộ field schema trước khi ghi Firestore.

FIRESTORE RULES
- Không thay đổi quyền.
- Nếu Rules V33 đang hoạt động thì KHÔNG cần publish rules mới.

CẬP NHẬT
1. Commit toàn bộ package V34 lên GitHub.
2. Chờ Vercel Ready.
3. Command + Shift + R.
4. Vào Cổng sự kiện một lần. Các event đang thiếu trường sẽ được kiểm tra/khôi phục.
5. Mở lại link public để kiểm tra.
