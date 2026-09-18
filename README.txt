OUR STAGE CLUB MANAGER V49 — GOOGLE POPUP FIX

NGUYÊN NHÂN LỖI V48
V48 có header:
Cross-Origin-Opener-Policy: same-origin

Google/Firebase OAuth dùng popup cần giữ liên lạc giữa cửa sổ website và popup đăng nhập.
COOP `same-origin` có thể tách popup cross-origin khỏi cửa sổ mở nó, làm Google Sign-In
thất bại dù:
- Google provider đã bật,
- domain đã Authorized,
- tài khoản đúng.

V49 sửa:
Cross-Origin-Opener-Policy: same-origin-allow-popups

Đây là chế độ phù hợp hơn cho OAuth popup, vẫn giữ chính sách COOP nhưng cho phép
cửa sổ popup xác thực hoạt động đúng.

CSP
V49 vẫn giữ CSP và chỉ thêm accounts.google.com vào:
- connect-src
- frame-src

CHẨN ĐOÁN
Nếu Google Auth vẫn lỗi, giao diện sẽ hiện mã Firebase dạng:
(auth/...)

Ví dụ:
- auth/unauthorized-domain
- auth/popup-blocked
- auth/operation-not-allowed
- auth/web-storage-unsupported
- auth/configuration-not-found

Không hiển thị token hoặc dữ liệu nhạy cảm.

FIRESTORE RULES
V49 không thay đổi Firestore Rules.
ZIP không chứa file Rules.

CẬP NHẬT
1. Commit toàn bộ V49 lên GitHub.
2. Không cần Publish Firestore Rules.
3. Chờ Vercel Ready.
4. Command + Shift + R.
5. Thử lại “Tiếp tục với Google” hoặc “Liên kết Google”.

LƯU Ý
Google provider vẫn phải bật trong Firebase Authentication và domain website vẫn phải
nằm trong Authorized domains.
