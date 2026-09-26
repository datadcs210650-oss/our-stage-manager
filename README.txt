OUR STAGE CLUB MANAGER V53 — SECURITY + SUCCESS STATE FIX

GITHUB “SECRET SCANNING 1”
Trong source cũ có Firebase Web API key được ghi trực tiếp trong 5 file HTML.
Đây rất có thể là mục GitHub Secret Scanning đang phát hiện.

Firebase Web API key không phải mật khẩu truy cập Firestore; Firebase công khai rằng
API key của Firebase Web app chỉ nhận diện project và quyền dữ liệu vẫn do
Security Rules + App Check quyết định.

Tuy vậy V53 vẫn loại API key khỏi repository để:
- tránh cảnh báo GitHub cho các commit mới;
- tránh tái sử dụng key nhầm ở nơi khác;
- quản lý cấu hình production bằng Vercel Environment Variables.

BẮT BUỘC TRƯỚC KHI DEPLOY V53
Vercel > Project > Settings > Environment Variables:
Name:
FIREBASE_WEB_API_KEY

Value:
Dán Firebase Web API key hiện tại của project clb-our.

Apply cho Production (và Preview nếu bạn muốn test preview), sau đó Redeploy.

V53 thêm:
api/firebase-config.js
Trang web tải Firebase config runtime từ chính domain Vercel.
Endpoint có Cache-Control: no-store và không chứa key trong GitHub source.

LƯU Ý QUAN TRỌNG
API key Firebase vẫn xuất hiện trong Network của trình duyệt khi website chạy.
Điều này là bình thường với Firebase Web. Không dùng API key làm lớp bảo mật dữ liệu.
Bảo mật dữ liệu phải dựa vào Firestore Rules và Firebase App Check.

GITHUB SECURITY
V53 thêm:
- .github/SECURITY.md
- .github/workflows/codeql.yml
- .github/dependabot.yml
- .gitignore
- .env.example (chỉ placeholder, không chứa key)

Secret Scanning alert cũ có thể vẫn còn vì GitHub quét cả lịch sử commit.
Sau khi xác nhận “View detected secrets” đúng là Firebase Web API key, bạn có thể
resolve alert theo chính sách GitHub. Nếu alert là Client Secret, Service Account,
Private Key hoặc token khác thì KHÔNG được đánh dấu an toàn; phải revoke/rotate.

CỔNG SỰ KIỆN SAU KHI GỬI
V53 sửa trạng thái thành công:
- Ngay khi Firestore ghi thành công, form bị xóa khỏi DOM.
- Input/textarea/select được reset và disabled trước khi xóa.
- Dừng listener realtime của event để snapshot mới không làm form xuất hiện lại.
- Xóa dòng trạng thái xanh “Đã gửi thông tin.” cũ.
- Chỉ hiển thị màn hình thành công.
- Tiêu đề mặc định chuyển thành “Đã gửi thông tin”.
- Không giữ câu trả lời trong localStorage/sessionStorage.

CHỐNG DỮ LIỆU QUÁ LỚN Ở CLIENT
- text/email/phone/MSSV: tối đa 250 ký tự.
- textarea: tối đa 4000 ký tự.
Đây là lớp UX/client; Firestore Rules vẫn là lớp bảo vệ server.

SECURITY HEADERS
Giữ CSP, HSTS, X-Frame-Options: DENY, Referrer-Policy, COOP/CORP.
Bổ sung:
- X-Robots-Tag: noindex, nofollow, noarchive
- Permissions-Policy chặn thêm browsing-topics
- no-store cho /api/firebase-config.js

FIRESTORE RULES
V53 không thay đổi Firestore Rules.
ZIP không chứa file Rules.

CẬP NHẬT
1. Tạo FIREBASE_WEB_API_KEY trong Vercel Environment Variables.
2. Commit toàn bộ V53 lên GitHub.
3. Redeploy Vercel.
4. Command + Shift + R.
5. Test Cổng sự kiện: nhập -> Gửi.
6. Sau thành công chỉ còn màn hình “Đã gửi thông tin”.
