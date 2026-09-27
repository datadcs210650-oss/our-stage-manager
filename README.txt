OUR STAGE CLUB MANAGER V56 — CENTERED BRAND + ACTIVITY COLUMN LOCK

1. SIDEBAR BRAND
- Logo OUR STAGE được đưa vào giữa phần đầu sidebar.
- Logo nằm trong ô nền trắng, căn giữa.
- OUR STAGE và CLUB MANAGER nằm giữa bên dưới.
- Chế độ sidebar thu gọn vẫn giữ logo giữa và ẩn chữ như trước.

2. KHÓA TỪNG CỘT ĐIỂM
Admin/Super Admin vào:
Thiết lập > Hoạt động

Mỗi hoạt động có thêm cột:
Khóa cột điểm

Trạng thái:
- 🔓 Đang mở: được phép nhập/chỉnh điểm.
- 🔒 Đã khóa: cột đã chốt, chỉ xem điểm.

Khi khóa một cột, hệ thống chặn:
- Sửa checkbox/điểm trực tiếp trong Điểm danh hoạt động.
- Import Excel vào cột đó.
- Tạo QR điểm danh mới cho cột đó.
- Duyệt QR để ghi điểm vào cột đó.
- Yêu cầu nhập điểm hàng loạt đã tạo trước đó.
- Hoàn tác nhật ký làm thay đổi điểm cột đó.
- Cộng điểm từ Cổng sự kiện vào cột đã khóa.
- Sửa thủ công cột Đồng hành nếu hoạt động đó được khóa.

Kết quả hiện có KHÔNG bị xóa khi khóa.

3. MỞ KHÓA
Admin có thể quay lại Thiết lập và bấm:
🔒 Đã khóa
để mở khóa cột nếu cần sửa điểm.

4. ĐỒNG BỘ
Trạng thái khóa được lưu trong cấu hình học kỳ trên Firestore:
semester.groups[].items[].locked

Dữ liệu cũ tự mặc định:
locked = false

Khi tạo học kỳ mới / nhân bản học kỳ:
các cột điểm luôn bắt đầu ở trạng thái mở khóa.

5. LƯU Ý BẢO MẬT
Khóa cột điểm là cơ chế chống nhập nhầm trong giao diện quản trị.
Nó không thay thế Firestore Security Rules và không phải một ranh giới bảo mật
chống người có quyền truy cập trực tiếp Firestore.

6. FIRESTORE RULES
V56 không thay đổi Firestore Rules.
ZIP không chứa Rules.
