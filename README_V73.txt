OUR STAGE CLUB MANAGER V73 — ACCOUNT API FIX

MỤC TIÊU
- Sửa lỗi đổi email BCN báo HTTP 404.
- Bổ sung đầy đủ backend Vercel API cho quản lý tài khoản.
- Giữ nguyên giao diện/chức năng V72 ngoài phần Tài khoản BCN.

NGUYÊN NHÂN LỖI CŨ
Frontend đã gọi các route /api/account-update, /api/account-create, /api/account-delete
nhưng package đang deploy không có thư mục api tương ứng. Vì vậy Vercel trả 404.

V73 BỔ SUNG
1. /api/account-create
   - Admin/Super Admin tạo BCN; Super Admin có thể tạo Admin.
   - Nếu email đã tồn tại trong Firebase Authentication nhưng chưa có users/{UID}, hệ thống liên kết hồ sơ quyền.
   - Không cần biết mật khẩu cũ của tài khoản đã tồn tại.

2. /api/account-update
   - Đổi tên, email đăng nhập, vai trò, trạng thái và quyền.
   - Email được cập nhật đồng thời Firebase Authentication + Firestore.
   - Giữ nguyên UID và dữ liệu liên quan.
   - Kiểm tra email trùng.
   - Có rollback Firebase Auth nếu Firestore ghi thất bại.
   - Khóa tài khoản sẽ disabled Firebase Auth và thu hồi refresh tokens.

3. /api/account-password
   - Admin/Super Admin có thể đặt lại mật khẩu của tài khoản được phép quản lý.
   - Không cần mật khẩu cũ.
   - Không lưu mật khẩu trong Firestore.
   - Thu hồi các phiên đăng nhập cũ sau khi đặt lại.

4. /api/account-delete
   - Xóa cả users/{UID} trong Firestore và Firebase Authentication.
   - Có rollback hồ sơ nếu xóa Authentication thất bại.
   - Không còn fallback client-side xóa Firestore đơn lẻ để tránh tài khoản Auth mồ côi.

5. /api/permissions-migrate
   - Khôi phục endpoint cũ để login không còn gọi vào route thiếu.
   - Chuẩn hóa permissions theo role một cách idempotent.

6. /api/health
   - Dùng kiểm tra nhanh API + Firebase Admin đã chạy hay chưa.

BẢO MẬT
- Mọi API quản lý tài khoản đều xác minh Firebase ID Token.
- Kiểm tra role server-side, không chỉ dựa vào nút/checkbox trên frontend.
- Admin chỉ quản lý BCN.
- Super Admin quản lý Admin/BCN nhưng không chỉnh Super Admin qua các endpoint này.
- Không cho thao tác quản trị nhắm vào chính UID đang đăng nhập.
- Service Account secret không được đặt trong HTML, firebase-public-config.js hoặc commit lên GitHub.

CẤU HÌNH VERCEL — BẮT BUỘC
Vào Vercel -> Project -> Settings -> Environment Variables.

Cách A (khuyến nghị dễ kiểm tra): tạo 3 biến
FIREBASE_PROJECT_ID=clb-our
FIREBASE_CLIENT_EMAIL=<client_email trong Service Account JSON>
FIREBASE_PRIVATE_KEY=<private_key trong Service Account JSON>

FIREBASE_PRIVATE_KEY có thể là nhiều dòng thật hoặc chứa \\n; code V73 xử lý cả hai dạng.

HOẶC Cách B: tạo 1 biến
FIREBASE_SERVICE_ACCOUNT=<toàn bộ Service Account JSON trên một biến>

Không cần đặt cả A và B; nếu FIREBASE_SERVICE_ACCOUNT tồn tại thì code ưu tiên biến này.

SAU KHI THÊM ENV
1. Redeploy Vercel.
2. Mở: https://ourstageclubmanager.vercel.app/api/health
3. Kết quả đúng:
   {"ok":true,"service":"our-stage-account-api","projectId":"clb-our"}
4. Nếu /api/health trả 404: repo chưa có đúng thư mục /api hoặc Vercel chưa deploy commit mới.
5. Nếu /api/health trả 500: kiểm tra Firebase Admin Environment Variables.

TEST QUẢN LÝ TÀI KHOẢN
A. Đổi email
- Login Admin/Super Admin.
- Tài khoản BCN -> Chỉnh sửa.
- Đổi email -> Lưu thay đổi.
- Refresh: email mới vẫn hiển thị.
- Đăng xuất tài khoản BCN; đăng nhập bằng email mới.
- UID và quyền phải giữ nguyên.

B. Email trùng
- Đổi sang email của tài khoản khác.
- Phải báo: Email này đã được sử dụng bởi một tài khoản khác.

C. Đặt lại mật khẩu
- Chỉnh sửa tài khoản -> Đặt lại mật khẩu.
- Nhập mật khẩu mới 2 lần.
- Tài khoản phải đăng nhập được bằng mật khẩu mới.

D. Khóa / mở khóa
- Chọn trạng thái Khóa -> Lưu.
- Firebase Auth user sẽ bị disabled.
- Chọn Hoạt động -> Lưu để bật lại.

E. Xóa
- Xóa tài khoản.
- Hồ sơ users/{UID} và Firebase Authentication user đều phải biến mất.

LƯU Ý FIRESTORE RULES
V73 không yêu cầu thay đổi Rules chỉ để chạy các API này vì Firebase Admin chạy server-side.
Tuy nhiên hãy tiếp tục giữ Firestore Rules V69 đang dùng cho toàn bộ truy cập client/public portal.

CẤU TRÚC DEPLOY
Đưa toàn bộ nội dung thư mục này lên ROOT của repo GitHub, giữ nguyên:
/api
/lib
index.html
su-kien.html
diem-danh.html
tra-cuu.html
tra-cuu-tu-do.html
firebase-public-config.js
logo.png
logo-ui-centered.png
favicon.png
vercel.json
package.json

Không chỉ upload riêng index.html, vì nếu thiếu /api hoặc package.json thì lỗi 404 sẽ quay lại.
