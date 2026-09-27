OUR STAGE CLUB MANAGER V55 — STATIC FIREBASE CONFIG / LOGIN FIX

V55 bỏ hoàn toàn cơ chế FIREBASE_WEB_API_KEY trên Vercel vì cơ chế V53–V54 gây lỗi
khi deploy/upload thủ công và Vercel Function không nằm đúng cấu trúc.

Cấu trúc cần upload lên ROOT GitHub:
firebase-public-config.js
index.html
su-kien.html
tra-cuu.html
tra-cuu-tu-do.html
diem-danh.html
vercel.json
logo.png
...

KHÔNG CẦN:
- thư mục api/
- api/firebase-config.js
- api/firebase-health.js
- FIREBASE_WEB_API_KEY trên Vercel

Sau khi V55 chạy ổn, bạn có thể xóa FIREBASE_WEB_API_KEY khỏi Vercel để tránh nhầm lẫn.

BẢO MẬT
Firebase Web API key là cấu hình client của Firebase. Firebase công bố rằng key này
chỉ nhận diện project/app; quyền dữ liệu phải được bảo vệ bởi Firebase Authentication,
Firestore Security Rules và App Check.

Bạn nên vào Google Cloud > APIs & Services > Credentials:
- Chọn Browser key dùng cho Firebase.
- Application restrictions: HTTP referrers.
- Chỉ cho domain website của bạn và domain Firebase cần thiết.
- API restrictions: chỉ Firebase-related APIs app dùng.
- Không dùng key này cho Gemini/Generative Language API hoặc API nhạy cảm khác.

GITHUB SECRET SCANNING
GitHub có thể vẫn cảnh báo Firebase Web API key. Nếu alert đúng là Firebase Web key
đã được giới hạn chỉ cho Firebase thì đây không phải credential cấp quyền database.
Nếu alert là Client Secret, Service Account private key, Stripe secret, token đăng nhập...
thì phải revoke/rotate, không được bỏ qua.

FIRESTORE RULES
V55 không thay Firestore Rules.
ZIP không chứa Rules.

CẬP NHẬT
1. Upload toàn bộ V55 lên root repo.
2. firebase-public-config.js phải cùng cấp index.html.
3. Chờ Vercel deploy commit main mới.
4. Command + Shift + R.
5. Đăng nhập lại.
