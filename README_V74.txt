OUR STAGE CLUB MANAGER V74 — ACTIVITY EVENT PORTAL + UI FIX
==========================================================

MỤC TIÊU BẢN V74
1. Sửa vị trí logo + OUR STAGE ở menu trái.
2. Logo menu trái có thể bấm để quay về Tổng quan.
3. Tiêu đề cổng sự kiện hỗ trợ Enter/xuống dòng và giữ đúng xuống dòng ở giao diện public.
4. Mỗi hoạt động trong Thiết lập có thể tạo/quản lý cổng sự kiện riêng.
5. Cổng sự kiện vẫn dùng toàn bộ bộ chỉnh sửa trường form hiện có: text, MSSV, email, phone, textarea, radio, checkbox, select, date, section, content, image/QR, required, options, đổi thứ tự, xóa/thêm trường.
6. Rà soát cú pháp toàn bộ HTML/JS + Vercel API và giữ nguyên các tính năng V73.

THAY ĐỔI CHÍNH
- Sidebar brand chuyển về bố cục ngang, căn trái: logo bên trái, OUR STAGE bên phải.
- Bấm logo/brand (hoặc Enter/Space khi focus) => mở tab Tổng quan.
- Event title trong Admin đổi từ input thành textarea, tối đa 200 ký tự.
- Public su-kien.html dùng white-space: pre-line cho title/description để giữ newline.
- Thiết lập > Hoạt động có thêm cột “Cổng sự kiện”.
- Bấm Cổng => xem tất cả cổng đang liên kết với hoạt động, mở form, xem kết quả, chỉnh sửa hoặc tạo cổng mới.
- Cổng tạo từ hoạt động tự điền tên hoạt động, MSSV/Họ tên/Email/Ghi chú và liên kết activityId.
- Event Builder có thêm dropdown “Liên kết với hoạt động”. Có thể liên kết/gỡ liên kết thủ công.
- Nếu portal liên kết hoạt động có điểm, thao tác áp dụng kết quả sẽ ghi trực tiếp vào cột hoạt động hiện có, không tạo cột điểm sự kiện trùng.
- Với hoạt động dạng Tickbox, nút xử lý hiện “Ghi nhận tham gia”.
- Nếu xóa hoạt động đang có portal liên kết, hệ thống gỡ liên kết các portal trước rồi mới xóa hoạt động; portal và phản hồi vẫn được giữ.
- Package Node được pin 22.x thay vì >=18 để tránh cảnh báo tự nâng major trên Vercel.

TRIỂN KHAI
1. Giải nén ZIP.
2. Upload CÁC FILE BÊN TRONG thư mục lên ROOT repo GitHub (không lồng thêm một thư mục cấp ngoài).
3. Giữ nguyên Environment Variables V73:
   FIREBASE_PROJECT_ID
   FIREBASE_CLIENT_EMAIL
   FIREBASE_PRIVATE_KEY
4. Vercel tự build/deploy hoặc Redeploy.
5. Hard refresh sau khi deploy:
   macOS: Command + Shift + R
   Windows: Ctrl + Shift + R

FIRESTORE RULES
- V74 tương thích với firestore_rules_v69.rules đã dùng ở hệ thống hiện tại.
- Event portal rule V69 không whitelist top-level event fields nên linkedActivityId/linkedActivityGroupId/linkedActivityName không cần mở rộng rule.
- Submission point update V69 đã cho editAttendance cập nhật pointsApplied/pointsValue/pointsStatus/... nên logic ghi nhận hoạt động vẫn dùng đúng quyền server-side.
- File firestore_rules_v69.rules được kèm trong package để đối chiếu. Không cần publish lại nếu Rules V69 đang là bản đang chạy và chưa bị thay đổi.

CHECKLIST SAU DEPLOY
A. Logo/menu
- Đăng nhập.
- Logo + OUR STAGE nằm bên trái, cùng một hàng.
- Bấm brand => về Tổng quan.
- Thu gọn sidebar => chỉ còn logo và bấm vẫn về Tổng quan.

B. Tiêu đề xuống dòng
- Cổng sự kiện > Tạo/Chỉnh sửa.
- Nhập title 2 dòng bằng Enter.
- Lưu > Mở cổng.
- Public phải hiển thị đúng 2 dòng.

C. Cổng theo hoạt động
- Thiết lập > Hoạt động.
- Chọn nút Cổng trên một hoạt động.
- Tạo cổng mới.
- Chỉnh các trường form tùy ý, lưu.
- Quay lại Thiết lập: nút hiển thị Cổng (1).
- Bấm Cổng để Mở cổng / Kết quả / Chỉnh sửa.

D. Ghi nhận hoạt động
- Cổng liên kết phải có trường MSSV.
- Sau khi có phản hồi, vào Kết quả.
- Hoạt động Tickbox => Ghi nhận tham gia.
- Hoạt động Nhập điểm => cộng vào đúng item hoạt động đã liên kết.
- Không được tự tạo cột “Điểm từ cổng sự kiện” khi portal đã liên kết với activity.

E. Regression
- Đăng nhập Email/Password + Google.
- Danh sách thành viên / điểm danh / Thu Chi.
- Cổng sự kiện cũ.
- QR điểm danh.
- Tra cứu thành viên / tra cứu tự do.
- Tài khoản BCN: sửa email, đổi mật khẩu, khóa/mở, xóa.

KIỂM TRA KỸ THUẬT ĐÃ CHẠY
- node --check toàn bộ inline JavaScript của index/su-kien/diem-danh/tra-cuu/tra-cuu-tu-do: PASS.
- node --check toàn bộ api/*.js + lib/firebase-admin.js: PASS.
- package.json + vercel.json JSON parse: PASS.
- Kiểm tra asset local tham chiếu: không thiếu file.
