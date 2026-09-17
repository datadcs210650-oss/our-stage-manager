OUR STAGE CLUB MANAGER V45 — BCN PERMISSION + LOOKUP PRIVACY SYNC

PHÂN QUYỀN BCN
- Không có quyền Xem: menu bị ẩn, Workspace không mở được, openTab bị chặn,
  Global Search không trả dữ liệu và module không được render vào giao diện.
- Nếu Admin thu hồi quyền trong lúc BCN đang online, nội dung cũ được làm sạch
  và hệ thống tự chuyển BCN về chức năng còn quyền.
- Có quyền Xem nhưng không có Chỉnh sửa: chỉ xem; nút tạo/sửa/xóa/import bị ẩn/khóa.
- Dashboard và Cần chú ý chỉ hiển thị số liệu thuộc module BCN được cấp quyền.

FORM ĐỒNG HÀNH VÀ CỔNG TRA CỨU THÀNH VIÊN
- Public KHÔNG hiển thị Đã điền/Chưa điền Form Đồng hành.
- Public KHÔNG hiển thị Tiếp tục/Dừng đồng hành.
- Public KHÔNG xuất continuationResponses hoặc metadata kết quả form.
- Nếu hoạt động Đồng hành có điểm, public chỉ hiển thị Điểm hoạt động và số điểm.
- Admin/BCN có quyền Cổng sự kiện vẫn xem kết quả đầy đủ trong khu vực quản trị.

MIGRATION V45
- Admin đăng nhập lần đầu sẽ rà dữ liệu publicLookupSemesters cũ.
- Các activity Đồng hành cũ bị xóa field participated/status nhưng giữ earnedPoints.
- Các field continuationResponses/status/decision ngoài ý muốn bị xóa khỏi public record.
- Migration chạy một lần bằng marker settings/privacyMigrationV45.

FIRESTORE RULES
V45 không thay đổi Rules. Quyền server V44 hiện tại đã chặn public đọc event submissions
và chặn BCN ghi module không được cấp quyền.
Theo yêu cầu, ZIP V45 KHÔNG chứa file Rules.

CẬP NHẬT
1. Commit toàn bộ package V45 lên GitHub.
2. Không cần Publish Firestore Rules.
3. Chờ Vercel Ready.
4. Command + Shift + R.
5. Đăng nhập Admin một lần để migration public lookup cũ chạy.
