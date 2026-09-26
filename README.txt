OUR STAGE CLUB MANAGER V54 — RUNTIME CONFIG + LOGIN FIX

NGUYÊN NHÂN ĐĂNG NHẬP V53 KHÔNG VÀO
V53 có lỗi đường dẫn Vercel Function.

File:
api/firebase-config.js

Trên Vercel được gọi bằng:
 /api/firebase-config

không phải:
 /api/firebase-config.js

V53 lại nạp script từ /api/firebase-config.js nên runtime Firebase config có thể không
được tải. Khi đó JavaScript dừng từ đầu hoặc Firebase Auth nhận key sai, khiến form login
vẫn hiện nhưng nhập mật khẩu không thể vào hệ thống.

V54 SỬA
- Tất cả HTML dùng /api/firebase-config.
- vercel.json có rewrite tương thích:
  /api/firebase-config.js -> /api/firebase-config
  để tab cũ/cache cũ vẫn hoạt động.
- Không throw làm chết toàn bộ JavaScript nếu Environment Variable sai.
- Login hiển thị lỗi cấu hình rõ ràng.
- Chặn Email/Password và Google Login nếu key chưa hợp lệ.
- Nhận biết key sai định dạng, ví dụ Value = clb-our.
- Giữ API key ngoài source GitHub.

KIỂM TRA KHÔNG LỘ KEY
V54 thêm:
 /api/firebase-health

Mở:
 https://<domain>/api/firebase-health

Kết quả đúng:
 {
   "ok": true,
   "projectId": "clb-our",
   "environmentVariable": "FIREBASE_WEB_API_KEY",
   "configured": true,
   "keyFormatValid": true
 }

Endpoint health KHÔNG trả Firebase API key.

VERCEL ENVIRONMENT VARIABLE
Key:
 FIREBASE_WEB_API_KEY

Value:
 Firebase Web API key thật, bắt đầu bằng AIza...

Environment:
 Production
 và Preview nếu dùng Preview Deployment.

Sau khi sửa Environment Variable BẮT BUỘC Redeploy deployment mới.

FIRESTORE RULES
V54 không thay đổi Firestore Rules.
ZIP không chứa Rules.

CẬP NHẬT
1. Xác nhận FIREBASE_WEB_API_KEY trên Vercel có Value bắt đầu bằng AIza...
2. Upload toàn bộ V54, bao gồm thư mục api/.
3. Redeploy.
4. Mở /api/firebase-health.
5. Chỉ khi ok=true mới thử đăng nhập.
6. Command + Shift + R.
