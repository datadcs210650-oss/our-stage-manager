OUR STAGE CLUB MANAGER V48 — SIMPLE LOGIN + GOOGLE AUTH

GIAO DIỆN ĐĂNG NHẬP
Trang đăng nhập được tối giản:
- Bên trái chỉ còn Logo OUR STAGE CLUB.
- OUR STAGE CLUB.
- HỆ THỐNG QUẢN TRỊ.
- Đã bỏ toàn bộ headline “Quản lý CLB...”, mô tả, feature cards và footer thông tin.
- Bên phải chỉ còn form đăng nhập và nút Google.

ĐĂNG NHẬP GOOGLE
V48 thêm nút:
“Tiếp tục với Google”

Cơ chế:
1. Firebase Auth vẫn dùng SESSION persistence.
2. Chỉ tài khoản đã được cấp profile users/{uid} mới vào hệ thống.
3. Nếu email hiện có bằng Email/Password và Firebase yêu cầu liên kết provider:
   - V48 nhắc người dùng đăng nhập email/password một lần.
   - Sau khi mật khẩu đúng, credential Google đang chờ được link vào cùng Firebase user.
   - Từ lần sau có thể dùng nút Google.
4. Trong “Tài khoản của tôi” có trạng thái Google:
   - Đã liên kết / Chưa liên kết.
   - Có nút “Liên kết Google” cho tài khoản chưa liên kết.
5. Nếu tài khoản chỉ đăng nhập Google và không có password provider, nút Đổi mật khẩu được ẩn.

BẮT BUỘC CẤU HÌNH FIREBASE
Code không thể tự bật provider Google trong Firebase Console.
Bạn cần:
1. Firebase Console.
2. Authentication.
3. Sign-in method.
4. Bật Google.
5. Chọn email hỗ trợ nếu Firebase yêu cầu.
6. Save.
7. Authentication > Settings > Authorized domains:
   đảm bảo domain Vercel/domain chính thức của website đã nằm trong danh sách.

FIRESTORE RULES
V48 không thay đổi Firestore Rules.
ZIP không chứa file Rules.

CẬP NHẬT
1. Commit toàn bộ V48 lên GitHub.
2. Không cần Publish Firestore Rules.
3. Bật Google provider trong Firebase Authentication.
4. Kiểm tra Authorized domains.
5. Chờ Vercel Ready.
6. Command + Shift + R.

KHUYẾN NGHỊ CHUYỂN TÀI KHOẢN CŨ
Cách an toàn nhất:
- Thành viên/Admin đăng nhập bằng Email + Password hiện tại.
- Vào Tài khoản của tôi.
- Bấm Liên kết Google.
- Chọn đúng Google account có cùng email.
- Sau đó đăng xuất và thử “Tiếp tục với Google”.
