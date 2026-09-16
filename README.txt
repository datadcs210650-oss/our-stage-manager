OUR STAGE CLUB MANAGER V41 — UI ISOLATION + PUBLIC PORTAL REDESIGN

ĐÃ SỬA LỖI V40 LOGIN ĐÈ APP
Nguyên nhân: .login-screen và .app dùng display !important sau .hidden nên hai lớp cùng hiện.
V41 dùng auth-login/auth-admin và CSS isolation riêng. Chưa đăng nhập chỉ thấy Login; đã đăng nhập chỉ thấy App.

PUBLIC PORTAL ĐỒNG BỘ GIAO DIỆN
- Cổng sự kiện
- Tra cứu thành viên
- Tra cứu tự do
- QR điểm danh
Tất cả dùng topbar OUR STAGE, nền/card cùng hệ thống Admin, responsive, privacy notice và footer thống nhất.

BẢO MẬT
- Giữ Firestore Rules V40, không nới quyền.
- robots noindex/nofollow/noarchive trên các trang.
- Cache-Control no-store cho mọi entry page.
- CSP, HSTS, X-Frame-Options, COOP/CORP, Referrer-Policy, Permissions-Policy.
- Sidebar Admin không thể lộ ở màn Login.

CẬP NHẬT
1. Thay toàn bộ các file HTML + vercel.json của V41 lên GitHub.
2. GIỮ NGUYÊN thư mục api/ và lib/ hiện có trong repository nếu repo của bạn đang có chúng. Package này không xóa backend hiện tại.
3. Chờ Vercel Ready.
4. Rules V41 giống quyền V40; không bắt buộc publish lại nếu V40 đã chạy.
5. Command + Shift + R.
