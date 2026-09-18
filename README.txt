OUR STAGE CLUB MANAGER V47 — AUTO SEMESTER ON LOGIN

THAY ĐỔI
Mỗi lần đăng nhập thành công, hệ thống tự chọn học kỳ theo tháng hiện tại:

- Tháng 01–04 -> Spring (SP)
- Tháng 05–08 -> Summer (SU)
- Tháng 09–12 -> Fall (FA)

Ví dụ:
- 18/09/2026 -> FA26
- 10/03/2027 -> SP27
- 20/07/2027 -> SU27

CÁCH HOẠT ĐỘNG
- Sau khi tải dữ liệu học kỳ từ Firestore, hệ thống xác định kỳ hiện tại bằng ngày trên thiết bị.
- Nếu kỳ đó tồn tại, hệ thống vào thẳng kỳ đó.
- Nếu kỳ chính xác chưa được tạo, hệ thống KHÔNG tự tạo dữ liệu. Nó chọn kỳ hợp lệ gần nhất trước thời điểm hiện tại.
- Sau khi vào hệ thống, Admin/BCN vẫn đổi học kỳ bằng menu học kỳ như bình thường.
- Việc đổi kỳ thủ công chỉ áp dụng cho phiên đang dùng. Lần đăng nhập mới tiếp theo lại tự chọn theo tháng hiện tại.

THỨ TỰ MENU HỌC KỲ
Danh sách được sắp theo:
SP -> SU -> FA -> SP năm sau.

FIRESTORE RULES
V47 không thay đổi Firestore Rules.
ZIP không chứa file Rules.

CẬP NHẬT
1. Thay toàn bộ V47 lên GitHub.
2. Không cần Publish Firestore Rules.
3. Chờ Vercel Ready.
4. Command + Shift + R.
5. Đăng xuất rồi đăng nhập lại để kiểm tra auto semester.
