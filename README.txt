OUR STAGE CLUB MANAGER V40 — PREMIUM DASHBOARD + SECURE SHELL

GIAO DIỆN
- Sidebar tối cố định, icon theo module, nhóm menu rõ ràng.
- Topbar kiểu dashboard hiện đại.
- Mỗi chức năng hiển thị như một cửa sổ ứng dụng.
- Workspace Dock giữ các chức năng vừa mở để chuyển nhanh.
- Sidebar thu gọn desktop / off-canvas mobile.
- Dashboard card màu nhấn, khoảng trắng và hiệu ứng chuyển động nhẹ.
- Cổng đăng nhập split-screen mới, đồng bộ phong cách với trang quản trị.

BẢO MẬT
- Firebase Auth dùng SESSION persistence cho lần đăng nhập mới.
- Tự đăng xuất sau 30 phút không thao tác, cảnh báo tại phút 28.
- Login error không phân biệt user-not-found / wrong-password.
- Login không hiển thị UID/email hoặc chi tiết Firestore kỹ thuật cho người dùng.
- Audit Logs chỉ cho cập nhật metadata hoàn tác, không sửa nội dung tùy ý.
- Notification content không thể bị tài khoản active sửa tùy ý; client chỉ cập nhật readBy.
- Bổ sung/giữ HSTS, CSP, X-Frame-Options, no-referrer, Permissions-Policy, COOP/CORP, no-store.

CẬP NHẬT
1. Commit toàn bộ package V40 lên GitHub.
2. Chờ Vercel Ready.
3. Firebase > Firestore Database > Rules.
4. Dán firestore_rules_v40.rules và Publish.
5. Command + Shift + R.

LƯU Ý
Không có website nào có thể cam kết tuyệt đối không bị tấn công. Nên tiếp tục kiểm thử Firestore Rules bằng Firebase Emulator/CI và rà soát quyền Admin/BCN định kỳ.
